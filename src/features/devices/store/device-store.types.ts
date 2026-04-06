export interface TasmotaDevice {
  id: string
  mqttTopic: string
  friendlyName: string
  ipAddress?: string
  macAddress?: string
  firmwareVersion?: string
  hardware?: string
  module?: string
  addedAt: number
  addedVia: 'manual' | 'mqtt-discovery'
}

export interface DeviceState {
  online: boolean
  lastSeen: number
  power: Record<string, boolean>
  sensors: Record<string, SensorReading>
  energy?: EnergyReading
  wifi?: WifiInfo
  uptime?: string
  loadAvg?: number
}

export interface SensorReading {
  value: number | string
  unit: string
  lastUpdated: number
}

export interface EnergyReading {
  voltage: number
  current: number
  power: number
  apparentPower: number
  reactivePower: number
  factor: number
  today: number
  yesterday: number
  total: number
}

export interface WifiInfo {
  ssid: string
  bssid?: string
  channel?: number
  rssi: number
  signal: number
  linkCount?: number
  downtime?: string
}

export interface DeviceStoreState {
  devices: Record<string, TasmotaDevice>
  deviceStates: Record<string, DeviceState>
  addDevice: (device: Omit<TasmotaDevice, 'id' | 'addedAt'>) => string
  removeDevice: (id: string) => void
  updateDevice: (id: string, partial: Partial<TasmotaDevice>) => void
  updateDeviceState: (id: string, partial: Partial<DeviceState>) => void
  setOnlineStatus: (mqttTopic: string, online: boolean) => void
  handleTelemetry: (mqttTopic: string, payload: Record<string, unknown>) => void
  handleStatResult: (mqttTopic: string, payload: Record<string, unknown>) => void
  getDeviceByTopic: (mqttTopic: string) => TasmotaDevice | undefined
}
