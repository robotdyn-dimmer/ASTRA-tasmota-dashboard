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

      mergeDevicesFromDevice: (remoteDevices) => {
        set((state) => {
          const merged = { ...state.devices }
          const mergedStates = { ...state.deviceStates }
          for (const [id, remote] of Object.entries(remoteDevices)) {
            // Add missing devices, update existing with remote fields
            merged[id] = { ...remote, ...merged[id], ...remote }
            if (!mergedStates[id]) mergedStates[id] = createEmptyState()
          }
          return { devices: merged, deviceStates: mergedStates }
        })
      },
    }),
    {
      name: 'astra-devices',
      partialize: (state) => ({ devices: state.devices }),
    }
  )
)
