/**
 * DeviceSseClient — manages a single SSE connection to one Tasmota device.
 *
 * Berry's astra_sse.be runs on port 81 and pushes:
 *   {type:'init',  POWER1:0|1, ...}   — current state on connect
 *   {type:'power', POWER1:0|1, ...}   — relay state changed
 *   {type:'state', POWER1:0|1, ...}   — periodic STATE telemetry
 *   {type:'sensor', DS18B20:{...}, ...} — sensor telemetry
 *
 * In dev mode, requests are routed through Vite's /device-sse/<ip> proxy
 * to bypass Chrome Private Network Access restrictions.
 */

import { parsePowerState, parseSensorPayload, parseEnergyPayload } from '@/shared/utils/tasmota-parsers'
import { useDeviceStore } from '@/features/devices/store/device-store'

export type SseConnectionState = 'connecting' | 'connected' | 'disconnected'

const IS_DEV = import.meta.env.DEV

function isPrivateIp(ip: string): boolean {
  return /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip.split(':')[0])
}

export class DeviceSseClient {
  private es: EventSource | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private _state: SseConnectionState = 'connecting'
  private failCount = 0
  private noDataCount = 0          // tracks "connected but no Berry data" failures
  private static MAX_NO_DATA = 3   // stop only if device has no Berry SSE
  readonly deviceId: string
  readonly ip: string

  onStateChange?: (state: SseConnectionState) => void

  constructor(deviceId: string, ip: string) {
    this.deviceId = deviceId
    this.ip = ip
    this.connect()
  }

  get connectionState(): SseConnectionState { return this._state }

  private sseUrl(): string {
    if (IS_DEV && isPrivateIp(this.ip)) return `/device-sse/${this.ip}`
    return `http://${this.ip}:81/astra/sse`
  }

  private connect() {
    this._state = 'connecting'
    this.onStateChange?.(this._state)

    try {
      this.es = new EventSource(this.sseUrl())
    } catch {
      this.scheduleReconnect()
      return
    }

    // After onopen fires (proxy sent headers), wait for actual data from Berry.
    // If no message arrives within 5s, device doesn't have Berry SSE → give up.
    let gotMessage = false
    const dataTimeout = setTimeout(() => {
      if (!gotMessage) {
        this.noDataCount++
        console.log(`[SSE] no data from ${this.ip} (${this.noDataCount}/${DeviceSseClient.MAX_NO_DATA})`)
        this.disconnect()
        if (this.noDataCount >= DeviceSseClient.MAX_NO_DATA) {
          // Device genuinely has no Berry SSE — stop trying
          console.log(`[SSE] giving up on ${this.ip} — no Berry SSE`)
          this.onStateChange?.('disconnected')
        } else {
          this._state = 'disconnected'
          this.onStateChange?.(this._state)
          this.scheduleReconnect(15000)
        }
      }
    }, 5000)

    this.es.onopen = () => {
      // Don't set 'connected' until we get actual data (init event)
    }

    this.es.onmessage = (evt) => {
      if (!gotMessage) {
        gotMessage = true
        clearTimeout(dataTimeout)
        this._state = 'connected'
        this.failCount = 0
        this.onStateChange?.(this._state)
        console.log(`[SSE] connected: ${this.ip}`)
      }
      try {
        this.handleMessage(JSON.parse(evt.data))
      } catch {
        // ignore malformed frames
      }
    }

    this.es.onerror = () => {
      clearTimeout(dataTimeout)
      this.es?.close()
      this.es = null
      this._state = 'disconnected'
      this.failCount++
      this.onStateChange?.(this._state)
      // Reconnect with increasing delay: 8s, 16s, 30s, 30s, ...
      const delay = Math.min(8000 * Math.pow(2, this.failCount - 1), 30000)
      console.log(`[SSE] error ${this.ip} (attempt ${this.failCount}), retry in ${delay / 1000}s`)
      this.scheduleReconnect(delay)
    }
  }

  private handleMessage(msg: Record<string, unknown>) {
    const type = msg.type as string
    if (!type) return

    const store = useDeviceStore.getState()
    const existing = store.deviceStates[this.deviceId]

    if (type === 'init' || type === 'power' || type === 'state') {
      // POWER1..N are integers 0 or 1 in Berry output
      const powerRaw: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(msg)) {
        if (k.startsWith('POWER')) powerRaw[k] = v === 1 ? 'ON' : 'OFF'
      }
      const newPower = parsePowerState(powerRaw)
      // Always mark online — receiving any SSE event proves device is reachable
      store.updateDeviceState(this.deviceId, {
        online: true,
        lastSeen: Date.now(),
        power: { ...(existing?.power ?? {}), ...newPower },
      })
    }

    if (type === 'sensor') {
      const sensors = parseSensorPayload(msg)
      const energy  = parseEnergyPayload(msg)
      if (Object.keys(sensors).length > 0 || energy) {
        store.updateDeviceState(this.deviceId, {
          online: true,
          lastSeen: Date.now(),
          sensors: { ...(existing?.sensors ?? {}), ...sensors },
          ...(energy ? { energy } : {}),
        })
      }
    }
  }

  private scheduleReconnect(delayMs = 8000) {
    if (this.reconnectTimer) return
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      if (this._state !== 'connected') this.connect()
    }, delayMs)
  }

  disconnect() {
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null }
    this.es?.close()
    this.es = null
    this._state = 'disconnected'
  }
}
