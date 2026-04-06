import { Power } from 'lucide-react'
import type { WidgetProps } from '@/features/widgets/registry/widget-types'
import { DeviceStatusBadge } from '@/features/devices/components/DeviceStatusBadge'
import { cn } from '@/shared/utils/cn'

export default function RelayToggleWidget({ devices, deviceStates, onCommand }: WidgetProps) {
  if (devices.length === 0) {
    return <div className="text-text-muted text-sm p-4">No device selected</div>
  }

  const device = devices[0]
  const state = deviceStates[0]
  const powerEntries = Object.entries(state?.power ?? {})

  return (
    <div className="h-full flex flex-col p-3">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-text truncate">{device.friendlyName}</h4>
        <DeviceStatusBadge online={state?.online ?? false} />
      </div>

      <div className="flex-1 flex flex-wrap gap-2 content-start">
        {powerEntries.length === 0 ? (
          <p className="text-xs text-text-dim">No relays detected</p>
        ) : (
          powerEntries.map(([relay, isOn]) => (
            <button
              key={relay}
              onClick={() => onCommand(device.id, `${relay} TOGGLE`)}
              disabled={!state?.online}
              className={cn(
                'flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-all flex-1 min-w-[100px] justify-center',
                isOn
                  ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                  : 'bg-surface-hover text-text-muted hover:bg-border',
                !state?.online && 'cursor-not-allowed opacity-50'
              )}
            >
              <Power size={18} className={cn(isOn && 'drop-shadow-sm')} />
              <span>{powerEntries.length > 1 ? relay.replace('POWER', 'Relay ') : isOn ? 'ON' : 'OFF'}</span>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
