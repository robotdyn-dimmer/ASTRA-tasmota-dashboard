export interface TasmotaDevice {
  id: string
  mqttTopic: string
  friendlyName: string
  friendlyNames?: string[]   // per-relay names from Tasmota FriendlyName1..N
  relayLabels?: Record<string, string>  // ASTRA custom labels: { POWER1: "Kitchen Light" }
  notes?: string             // ASTRA device notes
  room?: string              // user-assigned room/area for grouping
  ipAddress?: string
  macAddress?: string
  firmwareVersion?: string
  hardware?: string
  module?: string
  addedAt: number
  addedVia: 'manual' | 'mqtt-discovery'
}

/** GPIO function → entity mapping (populated from GPIO 255 response) */
export interface GpioEntityInfo {
  gpioPin:       number
  gpioCode:      number
  gpioName:      string              // "Relay1", "PWM2", "Button1_n"
  entityType:    import('@/features/widgets/registry/widget-types').PanelEntityType
  entityKey:     string              // "POWER1", "PWM1", "BUTTON1"
  controlRange?: [number, number]    // [0, 1023] for PWM/ADC
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
  gpioConfig?: GpioEntityInfo[]
  pwm?: Record<string, number>         // { PWM1: 512 }
  counters?: Record<string, number>    // { COUNTER1: 1234 }
  switches?: Record<string, boolean>   // { SWITCH1: true }
  adc?: Record<string, number>         // { ADC0: 523 }
  leds?: Record<string, boolean>       // { LedPower1: true }
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
  /** Merge devices from hub config — adds missing, updates existing (preserves local runtime state) */
  mergeDevicesFromDevice: (devices: Record<string, TasmotaDevice>) => void
}
