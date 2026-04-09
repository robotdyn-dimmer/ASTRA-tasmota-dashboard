import { X } from 'lucide-react'
import type { RuleCondition, TriggerOperator } from '@/features/rules/store/rule-store.types'
import type { TasmotaDevice, DeviceState } from '@/features/devices/store/device-store.types'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

// ── Helpers ───────────────────────────────────────────────────────────────────

const SELECT_CLS = 'h-9 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring'

const CONDITION_TYPES: { value: RuleCondition['type']; label: string }[] = [
  { value: 'sensor-compare', label: 'Sensor compare' },
  { value: 'power-state',    label: 'Power state' },
  { value: 'device-online',  label: 'Device online/offline' },
  { value: 'time-range',     label: 'Time range' },
  { value: 'day-of-week',    label: 'Day of week' },
  { value: 'and',            label: 'AND (all of…)' },
  { value: 'or',             label: 'OR (any of…)' },
  { value: 'not',            label: 'NOT (invert)' },
]

const OPERATORS: { value: TriggerOperator; label: string }[] = [
  { value: '>',  label: '>'  },
  { value: '<',  label: '<'  },
  { value: '>=', label: '>=' },
  { value: '<=', label: '<=' },
  { value: '==', label: '==' },
  { value: '!=', label: '!=' },
]

const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

function defaultCondition(type: RuleCondition['type']): RuleCondition {
  switch (type) {
    case 'sensor-compare': return { type, deviceId: '', sensorKey: '', operator: '>' }
    case 'power-state':    return { type, deviceId: '', relay: 'POWER', state: 'ON' }
    case 'device-online':  return { type, deviceId: '', state: 'online' }
    case 'time-range':     return { type, from: '00:00', to: '23:59' }
    case 'day-of-week':    return { type, days: [1, 2, 3, 4, 5] }
    case 'and':            return { type, conditions: [] }
    case 'or':             return { type, conditions: [] }
    case 'not':            return { type, condition: { type: 'device-online', deviceId: '', state: 'online' } }
  }
}

// ── DeviceSelector ────────────────────────────────────────────────────────────

function DeviceSelector({
  value,
  onChange,
  devices,
  className,
}: {
  value:     string
  onChange:  (id: string) => void
  devices:   Record<string, TasmotaDevice>
  className?: string
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className={`${SELECT_CLS} ${className ?? ''}`}
    >
      <option value="">— device —</option>
      {Object.values(devices).map(d => (
        <option key={d.id} value={d.id}>{d.friendlyName}</option>
      ))}
    </select>
  )
}

// ── ConditionEditor ───────────────────────────────────────────────────────────

interface ConditionEditorProps {
  condition:    RuleCondition
  onChange:     (c: RuleCondition) => void
  onRemove:     () => void
  devices:      Record<string, TasmotaDevice>
  deviceStates: Record<string, DeviceState>
  /** If true, don't render sub-condition lists (prevents infinite nesting) */
  shallow?:     boolean
}

export function ConditionEditor({
  condition,
  onChange,
  onRemove,
  devices,
  deviceStates,
  shallow = false,
}: ConditionEditorProps) {
  function setType(type: RuleCondition['type']) {
    onChange(defaultCondition(type))
  }

  function patch<T extends RuleCondition>(partial: Partial<T>) {
    onChange({ ...condition, ...partial } as RuleCondition)
  }

  return (
    <div className="border border-border rounded-lg p-3 bg-card space-y-2">
      {/* Header row: type select + remove */}
      <div className="flex items-center gap-2">
        <select
          value={condition.type}
          onChange={e => setType(e.target.value as RuleCondition['type'])}
          className={`${SELECT_CLS} flex-1`}
        >
          {CONDITION_TYPES.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
          onClick={onRemove}
        >
          <X size={14} />
        </Button>
      </div>

      {/* sensor-compare */}
      {condition.type === 'sensor-compare' && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <DeviceSelector
            value={condition.deviceId}
            onChange={v => patch({ deviceId: v })}
            devices={devices}
            className="w-full"
          />
          <Input
            value={condition.sensorKey}
            onChange={e => patch({ sensorKey: e.target.value })}
            placeholder="AM2301.Temperature"
            className="h-9 text-sm"
          />
          <select
            value={condition.operator}
            onChange={e => patch({ operator: e.target.value as TriggerOperator })}
            className={SELECT_CLS}
          >
            {OPERATORS.map(op => (
              <option key={op.value} value={op.value}>{op.label}</option>
            ))}
          </select>
          <Input
            type="number"
            value={condition.compareToLiteral ?? ''}
            onChange={e => patch({ compareToLiteral: e.target.value === '' ? undefined : Number(e.target.value) })}
            placeholder="value"
            className="h-9 text-sm"
          />
        </div>
      )}

      {/* power-state */}
      {condition.type === 'power-state' && (
        <div className="grid grid-cols-3 gap-2">
          <DeviceSelector
            value={condition.deviceId}
            onChange={v => patch({ deviceId: v })}
            devices={devices}
            className="w-full"
          />
          <Input
            value={condition.relay}
            onChange={e => patch({ relay: e.target.value })}
            placeholder="POWER"
            className="h-9 text-sm"
          />
          <select
            value={condition.state}
            onChange={e => patch({ state: e.target.value as 'ON' | 'OFF' })}
            className={SELECT_CLS}
          >
            <option value="ON">ON</option>
            <option value="OFF">OFF</option>
          </select>
        </div>
      )}

      {/* device-online */}
      {condition.type === 'device-online' && (
        <div className="grid grid-cols-2 gap-2">
          <DeviceSelector
            value={condition.deviceId}
            onChange={v => patch({ deviceId: v })}
            devices={devices}
            className="w-full"
          />
          <select
            value={condition.state}
            onChange={e => patch({ state: e.target.value as 'online' | 'offline' })}
            className={SELECT_CLS}
          >
            <option value="online">Online</option>
            <option value="offline">Offline</option>
          </select>
        </div>
      )}

      {/* time-range */}
      {condition.type === 'time-range' && (
        <div className="flex items-center gap-2">
          <Input
            type="time"
            value={condition.from}
            onChange={e => patch({ from: e.target.value })}
            className="h-9 text-sm w-32"
          />
          <span className="text-sm text-muted-foreground">to</span>
          <Input
            type="time"
            value={condition.to}
            onChange={e => patch({ to: e.target.value })}
            className="h-9 text-sm w-32"
          />
        </div>
      )}

      {/* day-of-week */}
      {condition.type === 'day-of-week' && (
        <div className="flex gap-1 flex-wrap">
          {DAY_LABELS.map((day, i) => {
            const active = condition.days.includes(i)
            return (
              <button
                key={i}
                type="button"
                onClick={() => {
                  const days = active
                    ? condition.days.filter(d => d !== i)
                    : [...condition.days, i].sort()
                  patch({ days })
                }}
                className={`w-9 h-9 rounded text-xs font-medium transition-colors ${
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {day}
              </button>
            )
          })}
        </div>
      )}

      {/* and / or — sub-condition list (1 level deep max) */}
      {(condition.type === 'and' || condition.type === 'or') && !shallow && (
        <div className="space-y-2 pl-3 border-l-2 border-border">
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
            {condition.type === 'and' ? 'All must be true' : 'At least one must be true'}
          </p>
          {condition.conditions.map((sub, idx) => (
            <ConditionEditor
              key={idx}
              condition={sub}
              onChange={updated => {
                const conditions = [...condition.conditions]
                conditions[idx] = updated
                patch({ conditions })
              }}
              onRemove={() => {
                const conditions = condition.conditions.filter((_, i) => i !== idx)
                patch({ conditions })
              }}
              devices={devices}
              deviceStates={deviceStates}
              shallow
            />
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => {
              patch({ conditions: [...condition.conditions, defaultCondition('device-online')] })
            }}
          >
            + Add sub-condition
          </Button>
        </div>
      )}

      {/* not — single sub-condition */}
      {condition.type === 'not' && !shallow && (
        <div className="pl-3 border-l-2 border-border">
          <p className="text-xs text-muted-foreground mb-2">Invert:</p>
          <ConditionEditor
            condition={condition.condition}
            onChange={updated => patch({ condition: updated })}
            onRemove={() => patch({ condition: defaultCondition('device-online') })}
            devices={devices}
            deviceStates={deviceStates}
            shallow
          />
        </div>
      )}

      {/* Shallow placeholder for nested and/or/not */}
      {(condition.type === 'and' || condition.type === 'or' || condition.type === 'not') && shallow && (
        <p className="text-xs text-muted-foreground italic">
          Nested group — edit in parent
        </p>
      )}
    </div>
  )
}

export { defaultCondition }
