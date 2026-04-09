import type { DeviceState, SensorReading, EnergyReading, WifiInfo, TasmotaDevice } from '@/features/devices/store/device-store.types'

export function parsePowerState(payload: Record<string, unknown>): Record<string, boolean> {
  const power: Record<string, boolean> = {}

  for (const [key, value] of Object.entries(payload)) {
    if (key.match(/^POWER\d*$/)) {
      power[key] = value === 'ON' || value === 1 || value === true
    }
  }

  return power
}

export function parseSensorPayload(payload: Record<string, unknown>): Record<string, SensorReading> {
  const sensors: Record<string, SensorReading> = {}
  const now = Date.now()

  for (const [key, value] of Object.entries(payload)) {
    if (key === 'Time' || key === 'TempUnit' || key === 'PressureUnit') continue

    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      const sensorData = value as Record<string, unknown>
      for (const [subKey, subValue] of Object.entries(sensorData)) {
        if (typeof subValue === 'number' || typeof subValue === 'string') {
          const unit = guessSensorUnit(subKey)
          sensors[`${key}.${subKey}`] = { value: subValue, unit, lastUpdated: now }
        }
      }
    } else if (typeof value === 'number' || typeof value === 'string') {
      const unit = guessSensorUnit(key)
      sensors[key] = { value, unit, lastUpdated: now }
    }
  }

  return sensors
}

export function parseEnergyPayload(payload: Record<string, unknown>): EnergyReading | undefined {
  const statusSNS = payload.StatusSNS as Record<string, unknown> | undefined
  const energy = (payload.ENERGY ?? statusSNS?.ENERGY ?? payload) as Record<string, unknown> | undefined
  if (!energy || typeof energy !== 'object') return undefined

  if (!('Power' in energy) && !('Voltage' in energy)) return undefined

  return {
    voltage: Number(energy.Voltage ?? 0),
    current: Number(energy.Current ?? 0),
    power: Number(energy.Power ?? 0),
    apparentPower: Number(energy.ApparentPower ?? 0),
    reactivePower: Number(energy.ReactivePower ?? 0),
    factor: Number(energy.Factor ?? 0),
    today: Number(energy.Today ?? 0),
    yesterday: Number(energy.Yesterday ?? 0),
    total: Number(energy.Total ?? 0),
  }
}

export function parseWifiInfo(payload: Record<string, unknown>): WifiInfo | undefined {
  const statusSTS = payload.StatusSTS as Record<string, unknown> | undefined
  const wifi = (payload.Wifi ?? statusSTS?.Wifi) as Record<string, unknown> | undefined
  if (!wifi || typeof wifi !== 'object') return undefined

  return {
    ssid: String(wifi.SSId ?? ''),
    bssid: wifi.BSSId ? String(wifi.BSSId) : undefined,
    channel: wifi.Channel ? Number(wifi.Channel) : undefined,
    rssi: Number(wifi.RSSI ?? 0),
    signal: Number(wifi.Signal ?? 0),
    linkCount: wifi.LinkCount ? Number(wifi.LinkCount) : undefined,
    downtime: wifi.Downtime ? String(wifi.Downtime) : undefined,
  }
}

export function parseStatus0(payload: Record<string, unknown>): Partial<TasmotaDevice> & Partial<DeviceState> {
  const result: Partial<TasmotaDevice> & Partial<DeviceState> = {}

  const status = payload.Status as Record<string, unknown> | undefined
  if (status) {
    const friendlyNames = status.FriendlyName as string[] | undefined
    result.friendlyName = String(friendlyNames?.[0] ?? status.DeviceName ?? '')
    if (Array.isArray(friendlyNames) && friendlyNames.length > 1) {
      result.friendlyNames = friendlyNames
    }
    result.module = String(status.Module ?? '')
    result.power = parsePowerState(status)
  }

  const statusFWR = payload.StatusFWR as Record<string, unknown> | undefined
  if (statusFWR) {
    result.firmwareVersion = String(statusFWR.Version ?? '')
    result.hardware = String(statusFWR.Hardware ?? '')
  }

  const statusNET = payload.StatusNET as Record<string, unknown> | undefined
  if (statusNET) {
    result.ipAddress = String(statusNET.IPAddress ?? '')
    result.macAddress = String(statusNET.Mac ?? '')
  }

  const statusSTS = payload.StatusSTS as Record<string, unknown> | undefined
  if (statusSTS) {
    result.uptime = String(statusSTS.Uptime ?? '')
    result.loadAvg = Number(statusSTS.LoadAvg ?? 0)
    result.wifi = parseWifiInfo(statusSTS)
    Object.assign(result.power ??= {}, parsePowerState(statusSTS))

    // PWM state: { PWM: { PWM1: 512, PWM2: 0 } } or flat { PWM1: 512 }
    const pwmData = statusSTS.PWM as Record<string, unknown> | undefined
    if (pwmData && typeof pwmData === 'object') {
      const pwm: Record<string, number> = {}
      for (const [k, v] of Object.entries(pwmData)) {
        if (/^PWM\d+$/i.test(k)) pwm[k.toUpperCase()] = Number(v)
      }
      if (Object.keys(pwm).length > 0) result.pwm = pwm
    }

    // Switch state from StatusSTS
    const switches: Record<string, boolean> = {}
    for (const [k, v] of Object.entries(statusSTS)) {
      if (/^Switch\d+$/i.test(k)) {
        switches[k.toUpperCase()] = v === 'ON' || v === 1 || v === true
      }
    }
    if (Object.keys(switches).length > 0) result.switches = switches

    // LedPower state from StatusSTS: { LedPower1: "ON" }
    const leds: Record<string, boolean> = {}
    for (const [k, v] of Object.entries(statusSTS)) {
      if (/^LedPower\d*$/i.test(k)) {
        const key = k.charAt(0).toUpperCase() + k.slice(1).replace(/power/i, 'Power')
        leds[key.match(/\d/) ? key : key + '1'] = v === 'ON' || v === 1 || v === true
      }
    }
    if (Object.keys(leds).length > 0) result.leds = leds
  }

  const statusSNS = payload.StatusSNS as Record<string, unknown> | undefined
  if (statusSNS) {
    result.sensors = parseSensorPayload(statusSNS)
    result.energy = parseEnergyPayload(statusSNS)

    // Counter state: { COUNTER: { C1: 1234, C2: 0 } }
    const counterData = statusSNS.COUNTER as Record<string, unknown> | undefined
    if (counterData && typeof counterData === 'object') {
      const counters: Record<string, number> = {}
      for (const [k, v] of Object.entries(counterData)) {
        const m = k.match(/^C(\d+)$/)
        if (m) counters[`COUNTER${m[1]}`] = Number(v)
      }
      if (Object.keys(counters).length > 0) result.counters = counters
    }

    // ADC state: { ANALOG: { A0: 523 } } or { ANALOG: { Temperature: 25.3 } }
    const analogData = statusSNS.ANALOG as Record<string, unknown> | undefined
    if (analogData && typeof analogData === 'object') {
      const adc: Record<string, number> = {}
      for (const [k, v] of Object.entries(analogData)) {
        adc[`ADC.${k}`] = Number(v)
      }
      if (Object.keys(adc).length > 0) result.adc = adc
    }
  }

  return result
}

function guessSensorUnit(key: string): string {
  const unitMap: Record<string, string> = {
    Temperature: '°C',
    Humidity: '%',
    Pressure: 'hPa',
    Illuminance: 'lx',
    Gas: 'kOhm',
    DewPoint: '°C',
    Voltage: 'V',
    Current: 'A',
    Power: 'W',
    Energy: 'kWh',
    Total: 'kWh',
    Today: 'kWh',
    Yesterday: 'kWh',
    Factor: '',
    Frequency: 'Hz',
    ApparentPower: 'VA',
    ReactivePower: 'VAr',
    Distance: 'mm',
    Weight: 'kg',
    Speed: 'km/h',
  }
  return unitMap[key] ?? ''
}

