/**
 * DeviceGpioTab — displays the GPIO pin configuration of a Tasmota device.
 *
 * Reads gpioConfig from device store (populated by poll-scheduler on first poll).
 * Manual Reload triggers a fresh GPIO 255 fetch and updates the store.
 */

import { useState, useCallback } from 'react'
import { RefreshCw, Loader2, Cpu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { tasmotaHttp } from '@/core/http/tasmota-http-client'
import { mapGpioToEntities } from '@/shared/utils/gpio-entity-mapper'
import { useDeviceStore } from '@/features/devices/store/device-store'
import type { TasmotaDevice, GpioEntityInfo } from '@/features/devices/store/device-store.types'

const CATEGORY_BADGE: Record<string, string> = {
  relay:        'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
  button:       'bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/30',
  switch_input: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  led:          'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-500/30',
  sensor:       'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30',
  energy:       'bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30',
  pwm:          'bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/30',
  counter:      'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30',
  adc:          'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/30',
}

const TYPE_LABELS: Record<string, string> = {
  relay: 'Relay', button: 'Button', switch_input: 'Switch', led: 'LED',
  sensor: 'Sensor', energy: 'Power monitor', pwm: 'PWM', counter: 'Counter', adc: 'ADC',
}

interface Props {
  device: TasmotaDevice
}

export function DeviceGpioTab({ device }: Props) {
  const gpioConfig = useDeviceStore(s => s.deviceStates[device.id]?.gpioConfig)
  const [loading, setLoading] = useState(false)
  const [moduleName, setModuleName] = useState(device.module || '')

  const reload = useCallback(async () => {
    if (!device.ipAddress) return
    setLoading(true)
    try {
      const result = await tasmotaHttp.sendCommand(device.ipAddress, 'GPIO 255')
      if (result.ok) {
        const entities = mapGpioToEntities(result.data)
        useDeviceStore.getState().updateDeviceState(device.id, { gpioConfig: entities })
      }
      // Refresh module name
      const modResult = await tasmotaHttp.sendCommand(device.ipAddress, 'Module')
      if (modResult.ok) {
        const modData = modResult.data as Record<string, unknown>
        const modObj = modData.Module as Record<string, unknown> | undefined
        if (modObj) setModuleName(String(Object.values(modObj)[0] ?? ''))
      }
    } catch { /* silent */ }
    setLoading(false)
  }, [device.ipAddress, device.id])

  if (!device.ipAddress) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          IP address required to read GPIO configuration.
        </CardContent>
      </Card>
    )
  }

  const entities = gpioConfig ?? []
  const usedTypes = [...new Set(entities.map(e => e.entityType))]

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Cpu size={14} />
          {moduleName && <span className="font-medium text-foreground">{moduleName}</span>}
          <span className="text-muted-foreground/60">
            {entities.length} entit{entities.length !== 1 ? 'ies' : 'y'}
          </span>
        </div>
        <Button variant="outline" size="sm" onClick={reload} disabled={loading} className="gap-1.5 shrink-0">
          {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
          Reload
        </Button>
      </div>

      {/* GPIO Entities */}
      {entities.length > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <p className="text-xs text-muted-foreground">GPIO pin assignments</p>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-1.5">
              {entities.map((entity: GpioEntityInfo) => (
                <div key={`${entity.gpioPin}-${entity.entityKey}`} className="flex items-center gap-3 py-1">
                  <span className="text-xs font-mono text-muted-foreground w-14 shrink-0">
                    GPIO{entity.gpioPin}
                  </span>
                  <Badge
                    variant="outline"
                    className={`text-xs font-medium px-2 py-0.5 ${CATEGORY_BADGE[entity.entityType] ?? 'bg-muted text-muted-foreground border-border'}`}
                  >
                    {entity.gpioName}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground/40 font-mono">
                    → {entity.entityKey}
                  </span>
                  <span className="text-[10px] text-muted-foreground/50 font-mono ml-auto">
                    #{entity.gpioCode}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {loading ? (
              <div className="flex items-center justify-center gap-2">
                <Loader2 size={16} className="animate-spin" />
                Reading GPIO configuration...
              </div>
            ) : (
              <>No GPIO data available. Click Reload to fetch.</>
            )}
          </CardContent>
        </Card>
      )}

      {/* Legend */}
      {usedTypes.length > 0 && (
        <div className="flex flex-wrap gap-2 text-xs">
          {usedTypes.map(type => (
            <span
              key={type}
              className={`px-2 py-0.5 rounded border text-[11px] ${CATEGORY_BADGE[type] ?? 'bg-muted text-muted-foreground border-border'}`}
            >
              {TYPE_LABELS[type] ?? type}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
