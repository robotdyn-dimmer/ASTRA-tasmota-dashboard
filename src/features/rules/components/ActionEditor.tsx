import { ChevronUp, ChevronDown, X } from 'lucide-react'
import type { RuleAction, ActionTransport, AutomationRule } from '@/features/rules/store/rule-store.types'
import type { TasmotaDevice } from '@/features/devices/store/device-store.types'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'

// ── Helpers ───────────────────────────────────────────────────────────────────

const SELECT_CLS = 'h-9 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring'

const ACTION_TYPES: { value: RuleAction['type']; label: string }[] = [
  { value: 'tasmota-command', label: 'Tasmota command' },
  { value: 'relay-set',       label: 'Set relay' },
  { value: 'mqtt-publish',    label: 'MQTT publish' },
  { value: 'delay',           label: 'Delay' },
  { value: 'notification',    label: 'Notification' },
  { value: 'http-request',    label: 'HTTP request' },
  { value: 'run-rule',        label: 'Run another rule' },
]

function defaultAction(type: RuleAction['type']): RuleAction {
  switch (type) {
    case 'tasmota-command': return { type, targetDeviceId: '', command: '', transport: 'auto' }
    case 'relay-set':       return { type, targetDeviceId: '', relay: 'POWER', state: 'TOGGLE', transport: 'auto' }
    case 'mqtt-publish':    return { type, topic: '', payload: '', retain: false, qos: 0 }
    case 'delay':           return { type, durationMs: 1000 }
    case 'notification':    return { type, title: '', body: '' }
    case 'http-request':    return { type, url: '', method: 'GET' }
    case 'run-rule':        return { type, ruleId: '' }
  }
}

function TransportSelect({
  value,
  onChange,
}: {
  value:    ActionTransport
  onChange: (v: ActionTransport) => void
}) {
  return (
    <select value={value} onChange={e => onChange(e.target.value as ActionTransport)} className={SELECT_CLS}>
      <option value="auto">Auto</option>
      <option value="mqtt">MQTT</option>
      <option value="http">HTTP</option>
    </select>
  )
}

function DeviceSelector({
  value,
  onChange,
  devices,
}: {
  value:    string
  onChange: (id: string) => void
  devices:  Record<string, TasmotaDevice>
}) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} className={`${SELECT_CLS} w-full`}>
      <option value="">— device —</option>
      {Object.values(devices).map(d => (
        <option key={d.id} value={d.id}>{d.friendlyName}</option>
      ))}
    </select>
  )
}

// ── ActionEditor ──────────────────────────────────────────────────────────────

interface ActionEditorProps {
  action:     RuleAction
  onChange:   (a: RuleAction) => void
  onRemove:   () => void
  onMoveUp:   () => void
  onMoveDown: () => void
  isFirst:    boolean
  isLast:     boolean
  devices:    Record<string, TasmotaDevice>
  rules:      Record<string, AutomationRule>
  /** Current rule id, to exclude from run-rule options */
  selfRuleId?: string
}

export function ActionEditor({
  action,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
  devices,
  rules,
  selfRuleId,
}: ActionEditorProps) {
  function setType(type: RuleAction['type']) {
    onChange(defaultAction(type))
  }

  function patch<T extends RuleAction>(partial: Partial<T>) {
    onChange({ ...action, ...partial } as RuleAction)
  }

  const otherRules = Object.values(rules).filter(r => r.id !== selfRuleId)

  return (
    <div className="border border-border rounded-lg bg-card">
      {/* Header */}
      <div className="flex items-center gap-2 p-3 border-b border-border">
        {/* Reorder buttons */}
        <div className="flex flex-col gap-0.5 shrink-0">
          <button
            type="button"
            disabled={isFirst}
            onClick={onMoveUp}
            className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronUp size={13} />
          </button>
          <button
            type="button"
            disabled={isLast}
            onClick={onMoveDown}
            className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronDown size={13} />
          </button>
        </div>

        {/* Type select */}
        <select
          value={action.type}
          onChange={e => setType(e.target.value as RuleAction['type'])}
          className={`${SELECT_CLS} flex-1`}
        >
          {ACTION_TYPES.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>

        {/* Remove */}
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

      {/* Fields */}
      <div className="p-3 space-y-2">

        {/* tasmota-command */}
        {action.type === 'tasmota-command' && (
          <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <div className="space-y-1">
                <Label className="text-xs">Device</Label>
                <DeviceSelector
                  value={action.targetDeviceId}
                  onChange={v => patch({ targetDeviceId: v })}
                  devices={devices}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Command</Label>
                <Input
                  value={action.command}
                  onChange={e => patch({ command: e.target.value })}
                  placeholder="DIMMER 50"
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Transport</Label>
                <TransportSelect value={action.transport} onChange={v => patch({ transport: v })} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Supports <code className="bg-muted px-1 rounded">{'{{trigger.value}}'}</code> template variable</p>
          </>
        )}

        {/* relay-set */}
        {action.type === 'relay-set' && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="space-y-1">
              <Label className="text-xs">Device</Label>
              <DeviceSelector
                value={action.targetDeviceId}
                onChange={v => patch({ targetDeviceId: v })}
                devices={devices}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Relay</Label>
              <Input
                value={action.relay}
                onChange={e => patch({ relay: e.target.value })}
                placeholder="POWER"
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">State</Label>
              <select
                value={action.state}
                onChange={e => patch({ state: e.target.value as 'ON' | 'OFF' | 'TOGGLE' })}
                className={SELECT_CLS}
              >
                <option value="ON">ON</option>
                <option value="OFF">OFF</option>
                <option value="TOGGLE">TOGGLE</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Transport</Label>
              <TransportSelect value={action.transport} onChange={v => patch({ transport: v })} />
            </div>
          </div>
        )}

        {/* mqtt-publish */}
        {action.type === 'mqtt-publish' && (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Topic</Label>
                <Input
                  value={action.topic}
                  onChange={e => patch({ topic: e.target.value })}
                  placeholder="cmnd/device/POWER"
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Payload</Label>
                <Input
                  value={action.payload}
                  onChange={e => patch({ payload: e.target.value })}
                  placeholder="ON"
                  className="h-9 text-sm"
                />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  id="mqtt-retain"
                  checked={action.retain ?? false}
                  onCheckedChange={v => patch({ retain: v })}
                />
                <Label htmlFor="mqtt-retain" className="text-xs">Retain</Label>
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs">QoS</Label>
                <select
                  value={action.qos ?? 0}
                  onChange={e => patch({ qos: Number(e.target.value) as 0 | 1 | 2 })}
                  className={`${SELECT_CLS} w-20`}
                >
                  <option value={0}>0</option>
                  <option value={1}>1</option>
                  <option value={2}>2</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* delay */}
        {action.type === 'delay' && (
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              value={
                action.durationMs % 60000 === 0
                  ? action.durationMs / 60000
                  : action.durationMs / 1000
              }
              onChange={e => {
                const raw = Number(e.target.value)
                const isMin = action.durationMs % 60000 === 0
                patch({ durationMs: Math.max(0, raw * (isMin ? 60000 : 1000)) })
              }}
              className="h-9 text-sm w-28"
            />
            <select
              value={action.durationMs % 60000 === 0 ? 'minutes' : 'seconds'}
              onChange={e => {
                const current =
                  action.durationMs % 60000 === 0
                    ? action.durationMs / 60000
                    : action.durationMs / 1000
                patch({
                  durationMs: Math.max(0, current * (e.target.value === 'minutes' ? 60000 : 1000)),
                })
              }}
              className={`${SELECT_CLS} w-32`}
            >
              <option value="seconds">seconds</option>
              <option value="minutes">minutes</option>
            </select>
          </div>
        )}

        {/* notification */}
        {action.type === 'notification' && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Title</Label>
                <Input
                  value={action.title}
                  onChange={e => patch({ title: e.target.value })}
                  placeholder="Alert"
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Body</Label>
                <Input
                  value={action.body}
                  onChange={e => patch({ body: e.target.value })}
                  placeholder="Temperature is {{trigger.value}}°C"
                  className="h-9 text-sm"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Supports <code className="bg-muted px-1 rounded">{'{{trigger.value}}'}</code> template variable</p>
          </>
        )}

        {/* http-request */}
        {action.type === 'http-request' && (
          <div className="space-y-2">
            <div className="grid grid-cols-4 gap-2">
              <div className="col-span-1 space-y-1">
                <Label className="text-xs">Method</Label>
                <select
                  value={action.method}
                  onChange={e => patch({ method: e.target.value as 'GET' | 'POST' })}
                  className={SELECT_CLS}
                >
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                </select>
              </div>
              <div className="col-span-3 space-y-1">
                <Label className="text-xs">URL</Label>
                <Input
                  value={action.url}
                  onChange={e => patch({ url: e.target.value })}
                  placeholder="https://example.com/hook"
                  className="h-9 text-sm"
                />
              </div>
            </div>
            {action.method === 'POST' && (
              <div className="space-y-1">
                <Label className="text-xs">Body (optional)</Label>
                <Input
                  value={action.body ?? ''}
                  onChange={e => patch({ body: e.target.value || undefined })}
                  placeholder='{"value": "{{trigger.value}}"}'
                  className="h-9 text-sm font-mono text-xs"
                />
              </div>
            )}
          </div>
        )}

        {/* run-rule */}
        {action.type === 'run-rule' && (
          <div className="space-y-1">
            <Label className="text-xs">Rule to run</Label>
            <select
              value={action.ruleId}
              onChange={e => patch({ ruleId: e.target.value })}
              className={`${SELECT_CLS} w-full`}
            >
              <option value="">— select rule —</option>
              {otherRules.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
            {otherRules.length === 0 && (
              <p className="text-xs text-muted-foreground">No other rules available</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export { defaultAction }
