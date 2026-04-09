/**
 * DeviceSseManager — manages SSE connections for Tasmota devices.
 *
 * Connects to all online devices that have an IP. Devices without Berry SSE
 * will timeout (no data within 5s → DeviceSseClient gives up automatically).
 * This avoids a separate probe step and keeps the logic simple.
 */

import { DeviceSseClient } from './device-sse-client'
import { useDeviceStore } from '@/features/devices/store/device-store'

class DeviceSseManager {
  private clients = new Map<string, DeviceSseClient>()
  private storeUnsub: (() => void) | null = null

  start() {
    // Watch for devices coming online
    this.storeUnsub = useDeviceStore.subscribe((state, prevState) => {
      for (const [id, ds] of Object.entries(state.deviceStates)) {
        const prev = prevState.deviceStates[id]
        const device = state.devices[id]
        if (ds.online && !prev?.online && device?.ipAddress) {
          this.connectDevice(id, device.ipAddress)
        }
      }
      // Disconnect removed devices
      for (const [id] of this.clients) {
        if (!state.devices[id]) this.disconnectDevice(id)
      }
    })

    // Connect to devices already online
    const { devices, deviceStates } = useDeviceStore.getState()
    for (const device of Object.values(devices)) {
      if (device.ipAddress && deviceStates[device.id]?.online) {
        this.connectDevice(device.id, device.ipAddress)
      }
    }
  }

  stop() {
    this.storeUnsub?.()
    this.storeUnsub = null
    for (const [id] of this.clients) this.disconnectDevice(id)
  }

  isConnected(deviceId: string): boolean {
    return this.clients.get(deviceId)?.connectionState === 'connected'
  }

  private connectDevice(deviceId: string, ip: string) {
    if (this.clients.has(deviceId)) return
    const client = new DeviceSseClient(deviceId, ip)
    this.clients.set(deviceId, client)
  }

  private disconnectDevice(deviceId: string) {
    this.clients.get(deviceId)?.disconnect()
    this.clients.delete(deviceId)
  }
}

// Persist singleton across HMR to avoid duplicate connections
let _instance: DeviceSseManager
if (import.meta.hot?.data?.sseManager) {
  _instance = import.meta.hot.data.sseManager as DeviceSseManager
} else {
  _instance = new DeviceSseManager()
}
if (import.meta.hot) {
  import.meta.hot.data.sseManager = _instance
  import.meta.hot.dispose(() => _instance.stop())
}

export const deviceSseManager = _instance
