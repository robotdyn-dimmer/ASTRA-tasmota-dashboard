import { Power, Wifi, Thermometer, Zap, Clock } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { DeviceStatusBadge } from './DeviceStatusBadge'
import { Sparkline } from '@/shared/components/Sparkline'
import { cn } from '@/lib/utils'
import type { TasmotaDevice, DeviceState } from '@/features/devices/store/device-store.types'

interface DeviceCardProps {
  device: TasmotaDevice
  state: DeviceState
  onTogglePower: (relay: string) => void
  onClick?: () => void
}

function relayLabel(relay: string, isOn: boolean, count: number, device: TasmotaDevice): string {
  if (device.relayLabels?.[relay]) return device.relayLabels[relay]
  if (count <= 1) return isOn ? 'ON' : 'OFF'
  const idx = parseInt(relay.replace('POWER', ''), 10) - 1
  if (device.friendlyNames?.[idx]) return device.friendlyNames[idx]
  return relay.replace('POWER', '#')
}

export function DeviceCard({ device, state, onTogglePower, onClick }: DeviceCardProps) {
  const powerEntries = Object.entries(state.power)
  const hasSensors = Object.keys(state.sensors).length > 0
  const firstSensors = Object.entries(state.sensors).slice(0, 3)

  return (
    <Card
      className={cn(
        'transition-all shadow-sm hover:shadow-md',
        state.online
          ? 'hover:border-primary/30'
          : 'opacity-55 grayscale-[20%]',
        onClick && 'cursor-pointer'
      )}
      onClick={onClick}
    >
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold truncate">{device.friendlyName}</h3>
            <p className="text-xs text-muted-foreground mt-0.5 truncate font-mono">
              {device.ipAddress || device.mqttTopic}
            </p>
          </div>
          <DeviceStatusBadge online={state.online} />
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-4 space-y-3">
        {/* Power toggles */}
        {powerEntries.length > 0 && (
          state.online ? (
            <div className="flex flex-wrap gap-1.5">
              {powerEntries.map(([relay, isOn]) => (
                <button
                  key={relay}
                  onClick={(e) => { e.stopPropagation(); onTogglePower(relay) }}
                  className={cn(
                    'inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-xs font-medium transition-all max-w-[140px] overflow-hidden',
                    isOn
                      ? 'bg-amber-400/20 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300 ring-1 ring-amber-400/30'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80 ring-1 ring-border'
                  )}
                  title={relayLabel(relay, isOn, powerEntries.length, device)}
                >
                  <Power size={12} className={cn('shrink-0', isOn && 'text-amber-500 dark:text-amber-400')} />
                  <span className="truncate">{relayLabel(relay, isOn, powerEntries.length, device)}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-muted-foreground/50">
              <Power size={12} />
              <span>Offline — {powerEntries.length} relay{powerEntries.length > 1 ? 's' : ''}</span>
            </div>
          )
        )}

        {/* Sparkline — primary metric */}
        {state.online && (state.energy || hasSensors) && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Sparkline
              deviceId={device.id}
              sensorKey={state.energy ? 'ENERGY.Power' : Object.keys(state.sensors)[0]}
              width={80}
              height={20}
              color="var(--color-primary)"
            />
            <span className="truncate">
              {state.energy ? `${state.energy.power} W` : ''}
            </span>
          </div>
        )}

        {/* Sensor readings */}
        {hasSensors && (
          <div className="space-y-1.5">
            {firstSensors.map(([key, reading]) => (
              <div key={key} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <SensorIcon sensorKey={key} />
                  {formatSensorKey(key)}
                </span>
                <span className="font-semibold tabular-nums">
                  {reading.value} <span className="text-muted-foreground font-normal">{reading.unit}</span>
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="pt-2 border-t border-border/60 flex items-center gap-2 text-[11px] text-muted-foreground">
          {state.wifi && (
            <>
              <Wifi size={10} className={cn(
                state.wifi.rssi >= 60 ? 'text-green-500' :
                state.wifi.rssi >= 30 ? 'text-yellow-500' : 'text-red-400'
              )} />
              <span>{state.wifi.rssi}%</span>
            </>
          )}
          {state.lastSeen > 0 && (
            <span className="ml-auto flex items-center gap-1" title={new Date(state.lastSeen).toLocaleString()}>
              <Clock size={9} />
              {formatTimeAgo(state.lastSeen)}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function formatTimeAgo(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 10_000)     return 'just now'
  if (diff < 60_000)     return `${Math.floor(diff / 1000)}s ago`
  if (diff < 3_600_000)  return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return `${Math.floor(diff / 86_400_000)}d ago`
}

function SensorIcon({ sensorKey }: { sensorKey: string }) {
  if (sensorKey.includes('Temperature')) return <Thermometer size={11} className="text-red-400" />
  if (sensorKey.includes('Humidity'))    return <span className="text-blue-400">💧</span>
  if (sensorKey.includes('Power') || sensorKey.includes('Energy')) return <Zap size={11} className="text-yellow-500" />
  return null
}

function formatSensorKey(key: string): string {
  return key.split('.').at(-1) ?? key
}
