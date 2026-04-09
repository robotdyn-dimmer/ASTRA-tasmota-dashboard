import { Thermometer, Droplets, Gauge } from 'lucide-react'
import type { WidgetProps } from '@/features/widgets/registry/widget-types'
import { cn } from '@/lib/utils'

interface SensorConfig {
  sensorKey?:     string
  maxSensors?:    number
  decimalPlaces?: number
  showUnits?:     boolean
  listLayout?:    boolean
}

export default function SensorDisplayWidget({ devices, deviceStates, config }: WidgetProps) {
  if (devices.length === 0 || !deviceStates[0]) {
    return <div className="text-muted-foreground text-sm p-4">No device selected</div>
  }

  const device    = devices[0]
  const state     = deviceStates[0]
  const cfg       = config.settings as SensorConfig
  const filter    = cfg.sensorKey     ?? ''
  const maxItems  = cfg.maxSensors    ?? 6
  const decimals  = cfg.decimalPlaces ?? 1
  const showUnits = cfg.showUnits     ?? true
  const isList    = cfg.listLayout    ?? false

  const sensorEntries = Object.entries(state.sensors)
    .filter(([key]) => !filter || key.includes(filter))
    .slice(0, maxItems)

  return (
    <div className="h-full flex flex-col p-3">
      <h4 className="text-sm font-medium mb-3 truncate">{device.friendlyName}</h4>

      {sensorEntries.length === 0 ? (
        <p className="text-xs text-muted-foreground/70">No sensor data available</p>
      ) : isList ? (
        <div className="flex-1 space-y-1.5 overflow-auto">
          {sensorEntries.map(([key, reading]) => {
            const label = key.split('.').pop() ?? key
            return (
              <div key={key} className="flex items-center gap-2 text-sm px-1">
                <SensorIcon label={label} />
                <span className="text-muted-foreground text-xs flex-1">{label}</span>
                <span className="font-bold tabular-nums">
                  {typeof reading.value === 'number' ? reading.value.toFixed(decimals) : reading.value}
                </span>
                {showUnits && reading.unit && (
                  <span className="text-xs text-muted-foreground w-6 shrink-0">{reading.unit}</span>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="flex-1 grid grid-cols-2 gap-2">
          {sensorEntries.map(([key, reading]) => {
            const label = key.split('.').pop() ?? key
            return (
              <div
                key={key}
                className="bg-muted rounded-lg p-2.5 flex flex-col items-center justify-center"
              >
                <SensorIcon label={label} />
                <span className="text-lg font-bold mt-1 tabular-nums">
                  {typeof reading.value === 'number' ? reading.value.toFixed(decimals) : reading.value}
                </span>
                {showUnits && <span className="text-xs text-muted-foreground">{reading.unit}</span>}
                <span className="text-[10px] text-muted-foreground/70 mt-0.5">{label}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function SensorIcon({ label }: { label: string }) {
  if (label.includes('Temp'))  return <Thermometer size={16} className={cn('text-red-500 dark:text-red-400')} />
  if (label.includes('Humid')) return <Droplets    size={16} className={cn('text-blue-500 dark:text-blue-400')} />
  return <Gauge size={16} className="text-muted-foreground/70" />
}
