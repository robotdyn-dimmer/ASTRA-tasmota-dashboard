import { Power } from 'lucide-react'
import type { WidgetProps } from '@/features/widgets/registry/widget-types'
import { DeviceStatusBadge } from '@/features/devices/components/DeviceStatusBadge'
import { cn } from '@/lib/utils'

interface RelayConfig {
  showLabel?:     boolean
  showStatus?:    boolean
  confirmToggle?: boolean
  compactLayout?: boolean
}

export default function RelayToggleWidget({ devices, deviceStates, config, onCommand }: WidgetProps) {
  if (devices.length === 0) {
    return <div className="text-muted-foreground text-sm p-4">No device selected</div>
  }

  const device      = devices[0]
  const state       = deviceStates[0]
  const cfg         = config.settings as RelayConfig
  const showStatus  = cfg.showStatus  ?? true
  const showLabel   = cfg.showLabel   ?? true
  const confirmTgl  = cfg.confirmToggle ?? false
  const compact     = cfg.compactLayout ?? false

  // Filter out non-relay POWER entries (e.g. LEDs mapped as POWER5)
  // by cross-referencing GPIO config when available
  const gpioRelayKeys = state?.gpioConfig
    ?.filter(e => e.entityType === 'relay')
    .map(e => e.entityKey)
  const powerEntries = Object.entries(state?.power ?? {})
    .filter(([key]) => !gpioRelayKeys || gpioRelayKeys.includes(key))

  function handleToggle(relay: string) {
    if (confirmTgl && !window.confirm(`Toggle ${relay}?`)) return
    onCommand(device.id, `${relay} TOGGLE`)
  }

  return (
    <div className="h-full flex flex-col p-3">
      <div className="flex items-center gap-2 mb-3">
        {showStatus && <DeviceStatusBadge online={state?.online ?? false} />}
        <h4 className="text-sm font-medium truncate">{device.friendlyName}</h4>
      </div>

      <div className="flex-1 flex flex-wrap gap-2 content-start">
        {!state?.online && powerEntries.length > 0 ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground/50">
            <Power size={14} />
            <span>Device offline</span>
          </div>
        ) : powerEntries.length === 0 ? (
          <p className="text-xs text-muted-foreground/70">No relays detected</p>
        ) : (
          powerEntries.map(([relay, isOn]) => {
            const astraLabel = device?.relayLabels?.[relay]
            const friendlyNames = device?.friendlyNames
            const idx = parseInt(relay.replace('POWER', ''), 10) - 1
            const label = astraLabel
              || (powerEntries.length > 1
                ? (friendlyNames?.[idx] || relay.replace('POWER', 'Relay '))
                : (isOn ? 'ON' : 'OFF'))
            return (
              <button
                key={relay}
                disabled={!state?.online}
                onClick={() => handleToggle(relay)}
                className={cn(
                  'inline-flex items-center justify-center rounded-lg font-medium transition-all',
                  compact
                    ? 'w-11 h-11 p-0'
                    : 'flex-1 min-w-[100px] max-w-[200px] gap-2 h-10 px-3 text-sm',
                  isOn
                    ? 'bg-amber-400/20 text-amber-700 ring-1 ring-amber-400/30 shadow-sm dark:bg-amber-500/20 dark:text-amber-300'
                    : 'bg-muted text-muted-foreground ring-1 ring-border hover:bg-muted/80',
                  !state?.online && 'opacity-50 pointer-events-none'
                )}
                title={label}
              >
                <Power size={16} className={cn('shrink-0', isOn ? 'text-amber-500 dark:text-amber-400' : 'text-muted-foreground')} />
                {!compact && showLabel && <span className="truncate">{label}</span>}
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
