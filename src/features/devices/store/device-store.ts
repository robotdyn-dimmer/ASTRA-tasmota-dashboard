import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { deviceIdFromTopic } from '@/lib/tasmota-topic-utils'
import { parsePowerState, parseSensorPayload, parseEnergyPayload, parseWifiInfo } from '@/shared/utils/tasmota-parsers'
import { sensorHistoryDB } from '@/core/history/sensor-history-db'
import type { DeviceState, DeviceStoreState } from './device-store.types'

const createEmptyState = (): DeviceState => ({
  online: false,
  lastSeen: 0,
  power: {},
  sensors: {},
})

/** Normalize MAC: uppercase, strip colons/dashes/spaces. Empty/missing → '' */
function normMac(mac: string | undefined): string {
  if (!mac) return ''
  return mac.replace(/[:\-\s]/g, '').toUpperCase()
}

/** Score a device by how many fields are populated (used to pick survivor on dedupe) */
function fillScore(d: import('./device-store.types').TasmotaDevice | undefined): number {
  if (!d) return -1
  let score = 0
  if (d.friendlyName)    score += 2
  if (d.relayLabels)     score += 3
  if (d.notes)           score += 2
  if (d.room)            score += 1
  if (d.ipAddress)       score += 1
  if (d.firmwareVersion) score += 1
  if (d.hardware)        score += 1
  return score
}

export const useDeviceStore = create<DeviceStoreState>()(
  persist(
    (set, get) => ({
      devices: {},
      deviceStates: {},

      addDevice: (device) => {
        const id = deviceIdFromTopic(device.mqttTopic)
        set((state) => ({
          devices: {
            ...state.devices,
            [id]: { ...device, id, addedAt: Date.now() },
          },
          deviceStates: {
            ...state.deviceStates,
            [id]: state.deviceStates[id] ?? createEmptyState(),
          },
        }))
        return id
      },

      removeDevice: (id) => {
        set((state) => {
          const { [id]: _device, ...devices } = state.devices
          const { [id]: _state, ...deviceStates } = state.deviceStates
          return { devices, deviceStates }
        })
      },

      updateDevice: (id, partial) => {
        set((state) => ({
          devices: {
            ...state.devices,
            [id]: { ...state.devices[id], ...partial },
          },
        }))
      },

      updateDeviceState: (id, partial) => {
        set((state) => ({
          deviceStates: {
            ...state.deviceStates,
            [id]: { ...(state.deviceStates[id] ?? createEmptyState()), ...partial },
          },
        }))
      },

      setOnlineStatus: (mqttTopic, online) => {
        const device = get().getDeviceByTopic(mqttTopic)
        if (!device) return

        set((state) => ({
          deviceStates: {
            ...state.deviceStates,
            [device.id]: {
              ...(state.deviceStates[device.id] ?? createEmptyState()),
              online,
              lastSeen: Date.now(),
            },
          },
        }))
      },

      handleTelemetry: (mqttTopic, payload) => {
        const device = get().getDeviceByTopic(mqttTopic)
        if (!device) return

        const currentState = get().deviceStates[device.id] ?? createEmptyState()
        const newSensors = parseSensorPayload(payload)
        const sensors = { ...currentState.sensors, ...newSensors }
        const energy = parseEnergyPayload(payload) ?? currentState.energy
        const wifi = parseWifiInfo(payload) ?? currentState.wifi
        const power = { ...currentState.power, ...parsePowerState(payload) }
        const uptime = typeof payload.Uptime === 'string' ? payload.Uptime : currentState.uptime
        const loadAvg = typeof payload.LoadAvg === 'number' ? payload.LoadAvg : currentState.loadAvg
        const now = Date.now()

        // Persist numeric sensor readings to IndexedDB for history graphs
        const historyReadings = Object.entries(newSensors)
          .filter(([, r]) => typeof r.value === 'number')
          .map(([key, r]) => ({
            deviceId:  device.id,
            sensorKey: key,
            timestamp: now,
            value:     r.value as number,
          }))
        if (historyReadings.length > 0) {
          sensorHistoryDB.addReadings(historyReadings).catch(console.error)
        }

        // Also persist energy power to history
        if (energy && typeof energy.power === 'number') {
          sensorHistoryDB.addReading({
            deviceId: device.id, sensorKey: 'ENERGY.Power',
            timestamp: now, value: energy.power,
          }).catch(console.error)
        }

        set((state) => ({
          deviceStates: {
            ...state.deviceStates,
            [device.id]: {
              ...currentState,
              online: true,
              lastSeen: now,
              power,
              sensors,
              energy,
              wifi,
              uptime,
              loadAvg,
            },
          },
        }))
      },

      handleStatResult: (mqttTopic, payload) => {
        const device = get().getDeviceByTopic(mqttTopic)
        if (!device) return

        const currentState = get().deviceStates[device.id] ?? createEmptyState()
        const power = { ...currentState.power, ...parsePowerState(payload) }

        set((state) => ({
          deviceStates: {
            ...state.deviceStates,
            [device.id]: {
              ...currentState,
              online: true,
              lastSeen: Date.now(),
              power,
            },
          },
        }))
      },

      getDeviceByTopic: (mqttTopic) => {
        const devices = get().devices
        return Object.values(devices).find(d => d.mqttTopic === mqttTopic)
      },

      getDeviceByMac: (mac) => {
        const norm = normMac(mac)
        if (!norm) return undefined
        return Object.values(get().devices).find(d => normMac(d.macAddress) === norm)
      },

      mergeDevicesFromDevice: (remoteDevices) => {
        set((state) => {
          const merged = { ...state.devices }
          const mergedStates = { ...state.deviceStates }

          // Build MAC → existing local id map for fast lookup
          const localByMac = new Map<string, string>()
          for (const [localId, dev] of Object.entries(merged)) {
            const m = normMac(dev.macAddress)
            if (m) localByMac.set(m, localId)
          }

          for (const remote of Object.values(remoteDevices)) {
            const remoteMac = normMac(remote.macAddress)
            const existingLocalId = remoteMac ? localByMac.get(remoteMac) : undefined

            if (existingLocalId) {
              // Same physical device — merge into existing entry, keep local id
              const existing = merged[existingLocalId]
              merged[existingLocalId] = {
                ...remote,
                ...existing,
                // Prefer remote labels/notes/room if local entry doesn't have them
                relayLabels: existing.relayLabels ?? remote.relayLabels,
                notes:       existing.notes       ?? remote.notes,
                room:        existing.room        ?? remote.room,
                // But always keep local id and addedAt
                id:      existing.id,
                addedAt: existing.addedAt,
              }
            } else {
              // No local match — add as new (use remote id)
              merged[remote.id] = { ...remote }
              if (!mergedStates[remote.id]) mergedStates[remote.id] = createEmptyState()
              if (remoteMac) localByMac.set(remoteMac, remote.id)
            }
          }
          return { devices: merged, deviceStates: mergedStates }
        })
      },

      dedupeByMac: () => {
        let removedCount = 0
        set((state) => {
          const groups = new Map<string, string[]>()  // mac → ids
          for (const [id, dev] of Object.entries(state.devices)) {
            const m = normMac(dev.macAddress)
            if (!m) continue
            if (!groups.has(m)) groups.set(m, [])
            groups.get(m)!.push(id)
          }

          const idsToRemove = new Set<string>()
          for (const ids of groups.values()) {
            if (ids.length < 2) continue
            // Keep the entry with most populated fields; remove the rest
            const sorted = ids.slice().sort((a, b) => fillScore(state.devices[b]) - fillScore(state.devices[a]))
            const keepId = sorted[0]
            for (const id of sorted.slice(1)) {
              if (id !== keepId) idsToRemove.add(id)
            }
            console.log(`[dedupeByMac] MAC group: keeping ${keepId}, removing ${sorted.slice(1).join(', ')}`)
          }

          if (idsToRemove.size === 0) return state
          removedCount = idsToRemove.size

          const devices: typeof state.devices = {}
          const deviceStates: typeof state.deviceStates = {}
          for (const [id, dev] of Object.entries(state.devices)) {
            if (!idsToRemove.has(id)) devices[id] = dev
          }
          for (const [id, st] of Object.entries(state.deviceStates)) {
            if (!idsToRemove.has(id)) deviceStates[id] = st
          }
          return { devices, deviceStates }
        })
        return removedCount
      },
    }),
    {
      name: 'astra-devices',
      partialize: (state) => ({ devices: state.devices }),
    }
  )
)
