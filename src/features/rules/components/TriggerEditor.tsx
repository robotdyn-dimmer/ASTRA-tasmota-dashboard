import type { RuleTrigger, TriggerOperator } from '@/features/rules/store/rule-store.types'
import type { TasmotaDevice } from '@/features/devices/store/device-store.types'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// ── Helpers ───────────────────────────────────────────────────────────────────

const SELECT_CLS = 'w-full h-9 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring'

const TRIGGER_TYPES: { value: RuleTrigger['type']; label: string }[] = [
  { value: 'sensor-threshold', label: 'Sensor threshold' },
  { value: 'power-change',     label: 'Power change' },
  { value: 'device-online',    label: 'Device online/offline' },
  { value: 'mqtt-message',     label: 'MQTT message' },
  { value: 'time-cron',        label: 'Scheduled (cron)' },
  { value: 'time-interval',    label: 'Repeating interval' },
]

const OPERATORS: { value: TriggerOperator; label: string }[] = [
  { value: '>', label: '> greater than' },
  { value: '<', label: '< less than' },
  { value: '>=', label: '>= greater or equal' },
  { value: '<=', label: '<= less or equal' },
  { value: '==', label: '== equal' },
  { value: '!=', label: '!= not equal' },
]

const CRON_PRESETS = [
  { label: 'Every day at 07:00', value: '0 7 * * *' },
  { label: 'Weekdays at 08:00', value: '0 8 * * 1-5' },
  { label: 'Hourly', value: '0 * * * *' },
  { label: 'Every 15 min', value: '*/15 * * * *' },
]

// ── DeviceSelector ────────────────────────────────────────────────────────────

function DeviceSelector({
  value,
  onChange,
  devices,
  label,
}: {
  value: string
  onChange: (id: string) => void
  devices: Record<string, TasmotaDevice>
  label?: string
}) {
  const deviceList = Object.values(devices)
  return (
    <div className="space-y-1">
      {label && <Label className="text-xs">{label}</Label>}
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className={SELECT_CLS}
      >
        <option value="">— select device —</option>
        {deviceList.map(d => (
          <option key={d.id} value={d.id}>{d.friendlyName}</option>
        ))}
      </select>
    </div>
  )
}

// ── Default triggers ──────────────────────────────────────────────────────────

function defaultTrigger(type: RuleTrigger['type']): RuleTrigger {
  switch (type) {
    case 'sensor-threshold':
      return { type, deviceId: '', sensorKey: '', operator: '>', value: 0 }
    case 'power-change':
      return { type, deviceId: '', relay: 'POWER', to: 'any' }
    case 'device-online':
      return { type, deviceId: '', to: 'online' }
    case 'mqtt-message':
      return { type, topicPattern: '' }
    case 'time-cron':
      return { type, cron: '0 7 * * *' }
    case 'time-interval':
      return { type, intervalMs: 60000 }
  }
}

// ── TriggerEditor ─────────────────────────────────────────────────────────────

interface TriggerEditorProps {
  trigger:  RuleTrigger
  onChange: (t: RuleTrigger) => void
  devices:  Record<string, TasmotaDevice>
}

export function TriggerEditor({ trigger, onChange, devices }: TriggerEditorProps) {
  function setType(type: RuleTrigger['type']) {
    onChange(defaultTrigger(type))
  }

  function patch<T extends RuleTrigger>(partial: Partial<T>) {
    onChange({ ...trigger, ...partial } as RuleTrigger)
  }

  return (
    <div className="space-y-3">
      {/* Type selector */}
      <div className="space-y-1">
        <Label className="text-xs">Trigger type</Label>
        <select
          value={trigger.type}
          onChange={e => setType(e.target.value as RuleTrigger['type'])}
          className={SELECT_CLS}
        >
          {TRIGGER_TYPES.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      {/* Conditional fields */}
      {trigger.type === 'sensor-threshold' && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="col-span-2 sm:col-span-1">
            <DeviceSelector
              label="Device"
              value={trigger.deviceId}
              onChange={v => patch({ deviceId: v })}
              devices={devices}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Sensor key</Label>
            <Input
              value={trigger.sensorKey}
              onChange={e => patch({ sensorKey: e.target.value })}
              placeholder="AM2301.Temperature"
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Operator</Label>
            <select
              value={trigger.operator}
              onChange={e => patch({ operator: e.target.value as TriggerOperator })}
              className={SELECT_CLS}
            >
              {OPERATORS.map(op => (
                <option key={op.value} value={op.value}>{op.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Value</Label>
            <Input
              type="number"
              value={trigger.value}
              onChange={e => patch({ value: Number(e.target.value) })}
              className="h-9 text-sm"
            />
          </div>
          <div className="col-span-2 sm:col-span-4 space-y-1">
            <Label className="text-xs">Hysteresis (optional)</Label>
            <Input
              type="number"
              min={0}
              value={trigger.hysteresis ?? ''}
              onChange={e => patch({ hysteresis: e.target.value === '' ? undefined : Number(e.target.value) })}
              placeholder="e.g. 0.5 — prevents rapid re-triggering"
              className="h-9 text-sm max-w-xs"
            />
          </div>
        </div>
      )}

      {trigger.type === 'power-change' && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="col-span-2 sm:col-span-1">
            <DeviceSelector
              label="Device"
              value={trigger.deviceId}
              onChange={v => patch({ deviceId: v })}
              devices={devices}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Relay</Label>
            <Input
              value={trigger.relay}
              onChange={e => patch({ relay: e.target.value })}
              placeholder="POWER"
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">State</Label>
            <select
              value={trigger.to}
              onChange={e => patch({ to: e.target.value as 'ON' | 'OFF' | 'any' })}
              className={SELECT_CLS}
            >
              <option value="any">Any change</option>
              <option value="ON">Turns ON</option>
              <option value="OFF">Turns OFF</option>
            </select>
          </div>
        </div>
      )}

      {trigger.type === 'device-online' && (
        <div className="grid grid-cols-2 gap-3">
          <DeviceSelector
            label="Device"
            value={trigger.deviceId}
            onChange={v => patch({ deviceId: v })}
            devices={devices}
          />
          <div className="space-y-1">
            <Label className="text-xs">Goes</Label>
            <select
              value={trigger.to}
              onChange={e => patch({ to: e.target.value as 'online' | 'offline' })}
              className={SELECT_CLS}
            >
              <option value="online">Online</option>
              <option value="offline">Offline</option>
            </select>
          </div>
        </div>
      )}

      {trigger.type === 'mqtt-message' && (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Topic pattern</Label>
            <Input
              value={trigger.topicPattern}
              onChange={e => patch({ topicPattern: e.target.value })}
              placeholder="tele/+/SENSOR  (supports + and # wildcards)"
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Payload match (optional regex)</Label>
            <Input
              value={trigger.payloadMatch ?? ''}
              onChange={e => patch({ payloadMatch: e.target.value || undefined })}
              placeholder='e.g. "Temperature":\\s*2[5-9]'
              className="h-9 text-sm"
            />
          </div>
        </div>
      )}

      {trigger.type === 'time-cron' && (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Cron expression</Label>
            <Input
              value={trigger.cron}
              onChange={e => patch({ cron: e.target.value })}
              placeholder="0 7 * * *"
              className="h-9 text-sm font-mono"
            />
            <p className="text-xs text-muted-foreground">5-field cron: minute hour day month weekday</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Quick presets</Label>
            <div className="flex flex-wrap gap-1.5">
              {CRON_PRESETS.map(p => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => patch({ cron: p.value })}
                  className={`px-2.5 py-1 rounded text-xs border transition-colors ${
                    trigger.cron === p.value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {trigger.type === 'time-interval' && (
        <div className="space-y-1">
          <Label className="text-xs">Interval</Label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={10}
              value={
                trigger.intervalMs % 60000 === 0
                  ? trigger.intervalMs / 60000
                  : trigger.intervalMs / 1000
              }
              onChange={e => {
                const raw = Number(e.target.value)
                const isMinutes = trigger.intervalMs % 60000 === 0
                patch({ intervalMs: Math.max(10000, raw * (isMinutes ? 60000 : 1000)) })
              }}
              className="h-9 text-sm w-28"
            />
            <select
              value={trigger.intervalMs % 60000 === 0 ? 'minutes' : 'seconds'}
              onChange={e => {
                const current =
                  trigger.intervalMs % 60000 === 0
                    ? trigger.intervalMs / 60000
                    : trigger.intervalMs / 1000
                patch({
                  intervalMs: Math.max(10000, current * (e.target.value === 'minutes' ? 60000 : 1000)),
                })
              }}
              className={`${SELECT_CLS} w-32`}
            >
              <option value="seconds">seconds</option>
              <option value="minutes">minutes</option>
            </select>
          </div>
          <p className="text-xs text-muted-foreground">Minimum 10 seconds</p>
        </div>
      )}
    </div>
  )
}

// ── Trigger summary helper (used in RulesPage list) ───────────────────────────

export function triggerSummary(trigger: RuleTrigger, devices: Record<string, TasmotaDevice>): string {
  switch (trigger.type) {
    case 'sensor-threshold': {
      const d = devices[trigger.deviceId]?.friendlyName ?? trigger.deviceId
      return `${d}: ${trigger.sensorKey} ${trigger.operator} ${trigger.value}`
    }
    case 'power-change': {
      const d = devices[trigger.deviceId]?.friendlyName ?? trigger.deviceId
      const state = trigger.to === 'any' ? 'changes' : `turns ${trigger.to}`
      return `${d} ${trigger.relay} ${state}`
    }
    case 'device-online': {
      const d = devices[trigger.deviceId]?.friendlyName ?? trigger.deviceId
      return `${d} goes ${trigger.to}`
    }
    case 'mqtt-message':
      return `MQTT: ${trigger.topicPattern}`
    case 'time-cron':
      return `Cron: ${trigger.cron}`
    case 'time-interval': {
      const ms = trigger.intervalMs
      if (ms % 60000 === 0) return `Every ${ms / 60000} min`
      return `Every ${ms / 1000}s`
    }
  }
}
