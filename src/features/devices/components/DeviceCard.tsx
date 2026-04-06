import { Power, Wifi, Thermometer, Zap } from 'lucide-react'
import type { TasmotaDevice, DeviceState } from '@/features/devices/store/device-store.types'
import { DeviceStatusBadge } from './DeviceStatusBadge'
import { cn } from '@/shared/utils/cn'

interface DeviceCardProps {
  device: TasmotaDevice
  state: DeviceState
  onTogglePower: (relay: string) => void
  onClick?: () => void
}

export function DeviceCard({ device, state, onTogglePower, onClick }: DeviceCardProps) {
  const powerEntries = Object.entries(state.power)
  const hasSensors = Object.keys(state.sensors).length > 0
  const firstSensors = Object.entries(state.sensors).slice(0, 3)

  return (
    <div
      className={cn(
        'bg-card border border-border rounded-lg p-4 transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5',
        !state.online && 'opacity-60',
        onClick && 'cursor-pointer'
      )}
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-text truncate">{device.friendlyName}</h3>
          <p className="text-xs text-text-muted mt-0.5 truncate">
            {device.ipAddress || device.mqttTopic}
          </p>
        </div>
        <DeviceStatusBadge online={state.online} />
      </div>

      {/* Power toggles */}
      {powerEntries.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {powerEntries.map(([relay, isOn]) => (
            <button
              key={relay}
              onClick={(e) => {
                e.stopPropagation()
                onTogglePower(relay)
              }}
              disabled={!state.online}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                isOn
                  ? 'bg-primary text-primary-foreground hover:bg-primary-hover'
                  : 'bg-surface-hover text-text-muted hover:bg-border',
                !state.online && 'cursor-not-allowed opacity-50'
              )}
            >
              <Power size={14} />
              {powerEntries.length > 1 ? relay.replace('POWER', '#') : isOn ? 'ON' : 'OFF'}
            </button>
          ))}
        </div>
      )}

      {/* Sensor readings */}
      {hasSensors && (
        <div className="space-y-1.5">
          {firstSensors.map(([key, reading]) => (
            <div key={key} className="flex items-center justify-between text-xs">
              <span className="text-text-muted flex items-center gap-1">
                <SensorIcon sensorKey={key} />
                {formatSensorKey(key)}
              </span>
              <span className="text-text font-medium">
                {reading.value} {reading.unit}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Footer info */}
      {state.wifi && (
        <div className="mt-3 pt-2 border-t border-border flex items-center gap-2 text-xs text-text-dim">
          <Wifi size={12} />
          <span>{state.wifi.rssi}% RSSI</span>
          {state.uptime && <span className="ml-auto">Up: {state.uptime}</span>}
        </div>
      )}
    </div>
  )
}

function SensorIcon({ sensorKey }: { sensorKey: string }) {
  if (sensorKey.includes('Temperature')) return <Thermometer size={12} />
  if (sensorKey.includes('Power') || sensorKey.includes('Energy')) return <Zap size={12} />
  return null
}

function formatSensorKey(key: string): string {
  // "AM2301.Temperature" → "Temperature"
  const parts = key.split('.')
  return parts[parts.length - 1]
}
