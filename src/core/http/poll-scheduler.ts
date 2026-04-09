/**
 * HttpPollScheduler — manages background and active HTTP polling for devices.
 *
 * Two tiers:
 *   Background: ping all devices every 30s (online/offline detection)
 *   Active:     poll one device every 10s (Device Detail page)
 *
 * Pauses automatically when browser tab is hidden.
 */

import { tasmotaHttp } from './tasmota-http-client'
import { parseStatus0 } from '@/shared/utils/tasmota-parsers'
import { sensorHistoryDB } from '@/core/history/sensor-history-db'
import { useDeviceStore } from '@/features/devices/store/device-store'
import type { TasmotaDevice } from '@/features/devices/store/device-store.types'
import { deviceSseManager } from '@/core/sse/device-sse-manager'
import { mapGpioToEntities } from '@/shared/utils/gpio-entity-mapper'

const BG_INTERVAL_MS     = 30_000   // 30s between background pings
const ACTIVE_INTERVAL_MS = 10_000   // 10s for currently viewed device

class HttpPollScheduler {
  private bgTimer:     ReturnType<typeof setInterval> | null = null
  private activeTimer: ReturnType<typeof setInterval> | null = null
  private paused = false
  private astraConfigFetched = new Set<string>()
  private gpioConfigFetched = new Set<string>()

  // ── Lifecycle ────────────────────────────────────────────────────

  start(skipInitialPoll = false) {
    this.stop()
    this.setupVisibilityListener()
    this.scheduleBgPing(skipInitialPoll)
  }

  stop() {
    if (this.bgTimer)     clearInterval(this.bgTimer)
    if (this.activeTimer) clearInterval(this.activeTimer)
    this.bgTimer = this.activeTimer = null
    document.removeEventListener('visibilitychange', this.onVisibilityChange)
  }

  /** Trigger an immediate poll for all devices (call after adding a device) */
  refresh() {
    this.runBgPing()
  }

  /** Run first poll and wait for it — use during bootstrap to have state before UI renders */
  async initialPoll(): Promise<void> {
    await this.runBgPing()
  }

  // ── Active polling (Device Detail page) ──────────────────────────

  /** Call when user opens a Device Detail page */
  startActive(deviceId: string, ip: string) {
    this.stopActive()
    // Fetch immediately on open
    this.fetchDevice(deviceId, ip)

    this.activeTimer = setInterval(() => {
      if (!this.paused) this.fetchDevice(deviceId, ip)
    }, ACTIVE_INTERVAL_MS)
  }

  /** Call when user leaves Device Detail page */
  stopActive() {
    if (this.activeTimer) clearInterval(this.activeTimer)
    this.activeTimer = null
  }

  // ── Private ──────────────────────────────────────────────────────

  private scheduleBgPing(skipInitial = false) {
    if (!skipInitial) this.runBgPing()

    this.bgTimer = setInterval(() => {
      if (!this.paused) this.runBgPing()
    }, BG_INTERVAL_MS)
  }

  private async runBgPing() {
    const { devices } = useDeviceStore.getState()
    const withIp = Object.values(devices).filter(
      (d): d is TasmotaDevice & { ipAddress: string } => !!d.ipAddress
    )
    if (withIp.length === 0) return

    // Parallel fetch — each device is independent
    await Promise.allSettled(
      withIp.map(device => this.fetchDevice(device.id, device.ipAddress))
    )
  }

  private async fetchDevice(deviceId: string, ip: string) {
    const store = useDeviceStore.getState()
    try {
      const result = await tasmotaHttp.getFullStatus(ip)
      if (!result.ok) {
        // Don't mark offline if SSE is providing real-time updates
        if (!deviceSseManager.isConnected(deviceId)) {
          store.updateDeviceState(deviceId, { online: false, lastSeen: Date.now() })
        }
        return
      }

      const parsed = parseStatus0(result.data)
      // Never override ipAddress — we keep the address we used to connect
      const { friendlyName, ipAddress: _ip, macAddress, firmwareVersion, hardware, module: mod, ...stateUpdates } = parsed

      // Update metadata if changed
      const metadataPatch: Record<string, unknown> = {}
      if (friendlyName)     metadataPatch.friendlyName     = friendlyName
      if (macAddress)       metadataPatch.macAddress       = macAddress
      if (firmwareVersion)  metadataPatch.firmwareVersion  = firmwareVersion
      if (hardware)         metadataPatch.hardware         = hardware
      if (mod)              metadataPatch.module           = mod

      if (Object.keys(metadataPatch).length > 0) {
        store.updateDevice(deviceId, metadataPatch)
      }

      const now = Date.now()

      // Persist sensor readings to IndexedDB
      if (stateUpdates.sensors) {
        const readings = Object.entries(stateUpdates.sensors)
          .filter(([, r]) => typeof (r as { value: unknown }).value === 'number')
          .map(([key, r]) => ({
            deviceId, sensorKey: key, timestamp: now,
            value: (r as { value: number }).value,
          }))
        if (readings.length > 0) sensorHistoryDB.addReadings(readings).catch(console.error)
      }
      if (stateUpdates.energy && typeof stateUpdates.energy.power === 'number') {
        sensorHistoryDB.addReading({
          deviceId, sensorKey: 'ENERGY.Power', timestamp: now, value: stateUpdates.energy.power,
        }).catch(console.error)
      }

      store.updateDeviceState(deviceId, {
        online: true,
        lastSeen: now,
        ...stateUpdates,
      })

      // Fetch ASTRA per-device config (relay labels, notes) — once per session
      if (!this.astraConfigFetched.has(deviceId)) {
        this.astraConfigFetched.add(deviceId)
        tasmotaHttp.getAstraConfig(ip).then(cfg => {
          if (!cfg || (!cfg.relayLabels && !cfg.notes)) return
          const patch: Record<string, unknown> = {}
          if (cfg.relayLabels) patch.relayLabels = cfg.relayLabels
          if (cfg.notes)       patch.notes = cfg.notes
          useDeviceStore.getState().updateDevice(deviceId, patch)
        }).catch(() => { this.astraConfigFetched.delete(deviceId) })
      }

      // Fetch GPIO config (entity map) — once per session
      if (!this.gpioConfigFetched.has(deviceId)) {
        this.gpioConfigFetched.add(deviceId)
        tasmotaHttp.sendCommand(ip, 'GPIO 255').then(result => {
          if (!result.ok) return
          const gpioConfig = mapGpioToEntities(result.data)
          if (gpioConfig.length > 0) {
            useDeviceStore.getState().updateDeviceState(deviceId, { gpioConfig })
          }
        }).catch(() => { this.gpioConfigFetched.delete(deviceId) })
      }

    } catch {
      // Any error (timeout, network, CORS) → mark offline
      // But not if SSE is connected — device is clearly reachable via SSE
      if (!deviceSseManager.isConnected(deviceId)) {
        store.updateDeviceState(deviceId, { online: false, lastSeen: Date.now() })
      }
    }
  }

  private setupVisibilityListener() {
    document.addEventListener('visibilitychange', this.onVisibilityChange)
  }

  private onVisibilityChange = () => {
    this.paused = document.hidden
    // Resume: run bg ping immediately when tab becomes visible again
    if (!this.paused) this.runBgPing()
  }
}

export const pollScheduler = new HttpPollScheduler()
