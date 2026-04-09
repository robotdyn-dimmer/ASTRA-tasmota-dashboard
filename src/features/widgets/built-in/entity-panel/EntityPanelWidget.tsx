/**
 * EntityPanelWidget — displays entities from multiple Tasmota devices.
 *
 * Supports: relay, sensor, energy, pwm, counter, button, switch_input, adc, led.
 * Entity resolution uses mqttTopic (stable cross-browser) → finds device → reads state.
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { Power, Thermometer, Droplets, Gauge, Zap, AlertCircle, SlidersHorizontal, Hash, ToggleRight, Lightbulb, Radio, RotateCcw } from 'lucide-react'
import { useDeviceStore } from '@/features/devices/store/device-store'
import type { WidgetProps, PanelEntity, EntityPanelSettings } from '@/features/widgets/registry/widget-types'
import { cn } from '@/lib/utils'

export default function EntityPanelWidget({ config, onCommand }: WidgetProps) {
  const allDevices = useDeviceStore(s => s.devices)
  const allStates  = useDeviceStore(s => s.deviceStates)

  const settings  = config.settings as Partial<EntityPanelSettings>
  const title     = settings.panelTitle?.trim() || 'Entity Panel'
  const entities  = settings.entities ?? []
  const compact   = settings.compact ?? false

  if (entities.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-4 text-center text-sm text-muted-foreground gap-2">
        <Gauge size={24} className="text-muted-foreground/40" />
        <span>No entities added.<br />Click ⚙️ to configure.</span>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col p-2 gap-0.5 overflow-auto">
      <p className="text-xs font-semibold text-muted-foreground px-1 pb-1 shrink-0">{title}</p>

      {entities.map(entity => {
        const device = Object.values(allDevices).find(d => d.mqttTopic === entity.mqttTopic)
        const state  = device ? allStates[device.id] : undefined

        return (
          <EntityRow
            key={entity.id}
            entity={entity}
            deviceId={device?.id}
            device={device}
            deviceName={device?.friendlyName ?? entity.mqttTopic}
            state={state}
            compact={compact}
            onCommand={onCommand}
          />
        )
      })}
    </div>
  )
}

// ── Entity Row ────────────────────────────────────────────────────────────────

interface RowProps {
  entity:     PanelEntity
  deviceId?:  string
  device?:    ReturnType<typeof useDeviceStore.getState>['devices'][string]
  deviceName: string
  state?:     ReturnType<typeof useDeviceStore.getState>['deviceStates'][string]
  compact:    boolean
  onCommand:  (deviceId: string, command: string) => void
}

function EntityRow({ entity, deviceId, device, deviceName, state, compact, onCommand }: RowProps) {
  const rowH = compact ? 'h-8' : 'h-10'
  const label = entity.label || resolveEntityLabel(entity, device)

  if (!deviceId) {
    return (
      <div className={cn('flex items-center gap-2 px-1.5 rounded-lg opacity-40 select-none', rowH)}>
        <AlertCircle size={13} className="text-muted-foreground shrink-0" />
        <span className="text-xs text-muted-foreground flex-1 truncate">{label}</span>
        <span className="text-xs text-muted-foreground/60">not found</span>
      </div>
    )
  }

  const isOnline = state?.online ?? false

  // ── Relay ──
  if (entity.entityType === 'relay') {
    const isOn = state?.power?.[entity.entityKey] ?? false
    return (
      <div className={cn('flex items-center gap-2 px-1.5 rounded-lg', rowH, !isOnline && 'opacity-50')}>
        <Power size={13} className={isOn ? 'text-amber-500' : 'text-muted-foreground/50'} />
        <span className="text-xs flex-1 truncate" title={deviceName}>{label}</span>
        <button
          className={cn(
            'h-6 px-2.5 rounded-md text-[11px] font-medium transition-all shrink-0',
            isOn
              ? 'bg-amber-400/20 text-amber-700 dark:text-amber-300 ring-1 ring-amber-400/30'
              : 'bg-muted text-muted-foreground ring-1 ring-border'
          )}
          disabled={!isOnline}
          onClick={() => onCommand(deviceId, `${entity.entityKey} TOGGLE`)}
        >
          {isOn ? 'ON' : 'OFF'}
        </button>
      </div>
    )
  }

  // ── LED (toggle, uses LedPower<n> command) ──
  if (entity.entityType === 'led') {
    const isOn = state?.leds?.[entity.entityKey] ?? false
    return (
      <div className={cn('flex items-center gap-2 px-1.5 rounded-lg', rowH, !isOnline && 'opacity-50')}>
        <Lightbulb size={13} className={isOn ? 'text-yellow-400' : 'text-muted-foreground/50'} />
        <span className="text-xs flex-1 truncate" title={deviceName}>{label}</span>
        <button
          className={cn(
            'h-6 px-2.5 rounded-md text-[11px] font-medium transition-all shrink-0',
            isOn
              ? 'bg-yellow-400/20 text-yellow-700 dark:text-yellow-300 ring-1 ring-yellow-400/30'
              : 'bg-muted text-muted-foreground ring-1 ring-border'
          )}
          disabled={!isOnline}
          onClick={() => onCommand(deviceId, `${entity.entityKey} TOGGLE`)}
        >
          {isOn ? 'ON' : 'OFF'}
        </button>
      </div>
    )
  }

  // ── PWM (slider) ──
  if (entity.entityType === 'pwm') {
    return <PwmRow entity={entity} deviceId={deviceId} label={label} deviceName={deviceName} state={state} compact={compact} onCommand={onCommand} />
  }

  // ── Button (read-only indicator) ──
  if (entity.entityType === 'button') {
    return (
      <div className={cn('flex items-center gap-2 px-1.5 rounded-lg', rowH, !isOnline && 'opacity-50')}>
        <Radio size={13} className="text-muted-foreground/50 shrink-0" />
        <span className="text-xs flex-1 truncate" title={deviceName}>{label}</span>
        <span className="text-[11px] text-muted-foreground/50">input</span>
      </div>
    )
  }

  // ── Switch (read-only ON/OFF) ──
  if (entity.entityType === 'switch_input') {
    const isOn = state?.switches?.[entity.entityKey] ?? false
    return (
      <div className={cn('flex items-center gap-2 px-1.5 rounded-lg', rowH, !isOnline && 'opacity-50')}>
        <ToggleRight size={13} className={isOn ? 'text-emerald-500' : 'text-muted-foreground/50'} />
        <span className="text-xs flex-1 truncate" title={deviceName}>{label}</span>
        <span className={cn(
          'text-[11px] font-medium px-1.5 py-0.5 rounded',
          isOn
            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
            : 'bg-muted text-muted-foreground/60'
        )}>
          {isOn ? 'ON' : 'OFF'}
        </span>
      </div>
    )
  }

  // ── Counter (number + reset) ──
  if (entity.entityType === 'counter') {
    const value = state?.counters?.[entity.entityKey] ?? 0
    return (
      <div className={cn('flex items-center gap-2 px-1.5 rounded-lg', rowH, !isOnline && 'opacity-50')}>
        <Hash size={13} className="text-indigo-500 shrink-0" />
        <span className="text-xs flex-1 truncate" title={deviceName}>{label}</span>
        <span className="text-sm font-bold tabular-nums font-mono shrink-0">{value.toLocaleString()}</span>
        <button
          className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground/50 hover:text-foreground hover:bg-muted transition-colors shrink-0"
          disabled={!isOnline}
          onClick={() => onCommand(deviceId, `${entity.entityKey} 0`)}
          title="Reset counter"
        >
          <RotateCcw size={10} />
        </button>
      </div>
    )
  }

  // ── ADC (read-only value) ──
  if (entity.entityType === 'adc') {
    const value = state?.adc?.[entity.entityKey]
    return (
      <div className={cn('flex items-center gap-2 px-1.5 rounded-lg', rowH, !isOnline && 'opacity-50')}>
        <SlidersHorizontal size={13} className="text-cyan-500 shrink-0" />
        <span className="text-xs flex-1 truncate" title={deviceName}>{label}</span>
        <span className="text-sm font-bold tabular-nums shrink-0">{value !== undefined ? value : '—'}</span>
      </div>
    )
  }

  // ── Sensor ──
  if (entity.entityType === 'sensor') {
    const reading = state?.sensors?.[entity.entityKey]
    const value   = reading
      ? (typeof reading.value === 'number' ? reading.value.toFixed(1) : String(reading.value))
      : '—'
    const unit = reading?.unit ?? ''

    return (
      <div className={cn('flex items-center gap-2 px-1.5 rounded-lg', rowH, !isOnline && 'opacity-50')}>
        <SensorIcon sensorKey={entity.entityKey} />
        <span className="text-xs flex-1 truncate" title={deviceName}>{label}</span>
        <span className="text-sm font-bold tabular-nums shrink-0">{value}</span>
        {unit && <span className="text-[11px] text-muted-foreground w-5 shrink-0">{unit}</span>}
      </div>
    )
  }

  // ── Energy ──
  if (entity.entityType === 'energy') {
    const energy = state?.energy
    let displayValue = '—'
    let unitStr = ''

    if (energy) {
      switch (entity.entityKey) {
        case 'ENERGY.Power':    displayValue = String(energy.power);    unitStr = 'W';   break
        case 'ENERGY.Voltage':  displayValue = String(energy.voltage);  unitStr = 'V';   break
        case 'ENERGY.Current':  displayValue = String(energy.current);  unitStr = 'A';   break
        case 'ENERGY.Today':    displayValue = String(energy.today);    unitStr = 'kWh'; break
        case 'ENERGY.Total':    displayValue = String(energy.total);    unitStr = 'kWh'; break
        default: displayValue = '?'
      }
    }

    return (
      <div className={cn('flex items-center gap-2 px-1.5 rounded-lg', rowH, !isOnline && 'opacity-50')}>
        <Zap size={13} className="text-yellow-500 shrink-0" />
        <span className="text-xs flex-1 truncate" title={deviceName}>{label}</span>
        <span className="text-sm font-bold tabular-nums text-yellow-600 dark:text-yellow-400 shrink-0">
          {displayValue}
        </span>
        {unitStr && <span className="text-[11px] text-muted-foreground shrink-0">{unitStr}</span>}
      </div>
    )
  }

  return null
}

// ── PWM Row (with debounced slider) ──────────────────────────────────────────

function PwmRow({ entity, deviceId, label, deviceName, state, compact, onCommand }: {
  entity: PanelEntity; deviceId: string; label: string; deviceName: string
  state?: RowProps['state']; compact: boolean; onCommand: RowProps['onCommand']
}) {
  const isOnline = state?.online ?? false
  const storeValue = state?.pwm?.[entity.entityKey] ?? 0
  const [localValue, setLocalValue] = useState<number | null>(null)
  const [dragging, setDragging] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Show local value while dragging, otherwise show store value
  const displayValue = localValue ?? storeValue
  const pct = Math.round((displayValue / 1023) * 100)

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseInt(e.target.value, 10)
    setLocalValue(v)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      onCommand(deviceId, `${entity.entityKey} ${v}`)
      timerRef.current = null
    }, 300)
  }, [deviceId, entity.entityKey, onCommand])

  const handleEnd = useCallback(() => {
    setDragging(false)
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
    if (localValue !== null) {
      onCommand(deviceId, `${entity.entityKey} ${localValue}`)
      // Keep local value visible (don't reset to null) — prevents flicker back to old store value
    }
  }, [deviceId, entity.entityKey, localValue, onCommand])

  // Sync: reset local override when store updates (from any source)
  const prevStoreRef = useRef(storeValue)
  useEffect(() => {
    if (prevStoreRef.current !== storeValue) {
      prevStoreRef.current = storeValue
      if (!dragging) setLocalValue(null)
    }
  }, [storeValue, dragging])

  return (
    <div
      className={cn('flex items-center gap-2 px-1.5 rounded-lg', compact ? 'h-8' : 'h-10', !isOnline && 'opacity-50')}
      // Stop pointer events from reaching the grid drag handler
      onPointerDown={e => e.stopPropagation()}
      onMouseDown={e => e.stopPropagation()}
      onTouchStart={e => e.stopPropagation()}
    >
      <SlidersHorizontal size={13} className="text-amber-500 shrink-0" />
      <span className="text-xs flex-1 truncate min-w-0" title={deviceName}>{label}</span>
      <input
        type="range"
        min={0}
        max={1023}
        value={displayValue}
        onChange={handleChange}
        onMouseDown={() => setDragging(true)}
        onTouchStart={() => setDragging(true)}
        onMouseUp={handleEnd}
        onTouchEnd={handleEnd}
        disabled={!isOnline}
        className="w-20 h-1.5 shrink-0 cursor-pointer pwm-slider"
        style={{ '--pct': `${pct}%` } as React.CSSProperties}
      />
      <span className="text-[11px] font-mono tabular-nums text-amber-600 dark:text-amber-400 w-8 text-right shrink-0">{pct}%</span>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function resolveEntityLabel(
  entity: PanelEntity,
  device?: ReturnType<typeof useDeviceStore.getState>['devices'][string],
): string {
  if (entity.entityType === 'relay') {
    if (device?.relayLabels?.[entity.entityKey]) return device.relayLabels[entity.entityKey]
    const idx = parseInt(entity.entityKey.replace('POWER', ''), 10) - 1
    if (device?.friendlyNames?.[idx]) return device.friendlyNames[idx]
    return entity.entityKey.replace('POWER', 'Relay ')
  }
  if (entity.entityType === 'energy')       return entity.entityKey.replace('ENERGY.', '')
  if (entity.entityType === 'pwm')          return entity.entityKey.replace('PWM', 'PWM ')
  if (entity.entityType === 'counter')      return entity.entityKey.replace('COUNTER', 'Counter ')
  if (entity.entityType === 'button')       return entity.entityKey.replace('BUTTON', 'Button ')
  if (entity.entityType === 'switch_input') return entity.entityKey.replace('SWITCH', 'Switch ')
  if (entity.entityType === 'adc')          return entity.entityKey.replace('ADC.', '')
  if (entity.entityType === 'led')          return entity.entityKey.replace('LedPower', 'LED ')
  return entity.entityKey.split('.').pop() ?? entity.entityKey
}

function SensorIcon({ sensorKey }: { sensorKey: string }) {
  if (sensorKey.includes('Temp'))  return <Thermometer size={13} className="text-red-500 shrink-0" />
  if (sensorKey.includes('Humid')) return <Droplets    size={13} className="text-blue-500 shrink-0" />
  return <Gauge size={13} className="text-muted-foreground shrink-0" />
}
