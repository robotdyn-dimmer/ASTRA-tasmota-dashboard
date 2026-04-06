import { Thermometer, Droplets, Gauge } from 'lucide-react'
import type { WidgetProps } from '@/features/widgets/registry/widget-types'
import { cn } from '@/shared/utils/cn'

export default function SensorDisplayWidget({ devices, deviceStates, config }: WidgetProps) {
  if (devices.length === 0 || !deviceStates[0]) {
    return <div className="text-text-muted text-sm p-4">No device selected</div>
  }

  const device = devices[0]
  const state = deviceStates[0]
  const sensorFilter = config.settings.sensorKey as string | undefined
  const sensorEntries = Object.entries(state.sensors)
    .filter(([key]) => !sensorFilter || key.includes(sensorFilter))
    .slice(0, 6)

  return (
    <div className="h-full flex flex-col p-3">
      <h4 className="text-sm font-medium text-text mb-3 truncate">{device.friendlyName}</h4>

      {sensorEntries.length === 0 ? (
        <p className="text-xs text-text-dim">No sensor data available</p>
      ) : (
        <div className="flex-1 grid grid-cols-2 gap-2">
          {sensorEntries.map(([key, reading]) => {
            const label = key.split('.').pop() ?? key
            return (
              <div
                key={key}
                className="bg-surface-hover rounded-lg p-2.5 flex flex-col items-center justify-center"
              >
                <SensorIcon label={label} />
                <span className="text-lg font-bold text-text mt-1">
                  {typeof reading.value === 'number' ? reading.value.toFixed(1) : reading.value}
                </span>
                <span className="text-xs text-text-muted">{reading.unit}</span>
                <span className="text-[10px] text-text-dim mt-0.5">{label}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function SensorIcon({ label }: { label: string }) {
  const className = 'text-text-dim'
  if (label.includes('Temp')) return <Thermometer size={16} className={cn(className, 'text-danger')} />
  if (label.includes('Humid')) return <Droplets size={16} className={cn(className, 'text-blue-400')} />
  return <Gauge size={16} className={className} />
}
