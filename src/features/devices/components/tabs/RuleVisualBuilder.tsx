/**
 * RuleVisualBuilder — visual rule constructor with WHEN/THEN dropdowns.
 * Generates Tasmota rule text from UI selections.
 */

import { useState } from 'react'
import { Plus, Trash2, Wand2, LayoutTemplate } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  type VisualRule, type RuleTrigger, type RuleAction,
  createVisualRule, buildRuleText, RULE_TEMPLATES,
  minutesToTime, timeToMinutes,
} from '@/shared/utils/tasmota-rule-builder'

interface Props {
  sensorKeys: string[]    // e.g. ["AM2301#Temperature", "AM2301#Humidity"]
  relayCount: number      // number of relays on device
  switchCount: number     // number of switches
  buttonCount: number     // number of buttons
  onGenerate: (text: string) => void
}

export function RuleVisualBuilder({ sensorKeys, relayCount, switchCount, buttonCount, onGenerate }: Props) {
  const [rules, setRules] = useState<VisualRule[]>([createVisualRule()])
  const [showTemplates, setShowTemplates] = useState(false)

  const updateRule = (id: string, patch: Partial<VisualRule>) =>
    setRules(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r))

  const removeRule = (id: string) =>
    setRules(prev => prev.filter(r => r.id !== id))

  const addRule = () => setRules(prev => [...prev, createVisualRule()])

  const applyTemplate = (template: typeof RULE_TEMPLATES[number]) => {
    setRules(template.rules.map(r => ({ ...r, id: crypto.randomUUID() })))
    setShowTemplates(false)
  }

  const handleGenerate = () => {
    const text = buildRuleText(rules)
    if (text) onGenerate(text)
  }

  const nums = (n: number) => Array.from({ length: Math.max(n, 1) }, (_, i) => i + 1)

  return (
    <div className="space-y-3">

      {/* Templates */}
      {showTemplates ? (
        <div className="grid grid-cols-2 gap-2">
          {RULE_TEMPLATES.map(t => (
            <button
              key={t.name}
              onClick={() => applyTemplate(t)}
              className="text-left p-3 rounded-lg border border-border bg-card hover:border-primary/40 transition-colors"
            >
              <p className="text-xs font-medium">{t.name}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{t.description}</p>
            </button>
          ))}
          <button onClick={() => setShowTemplates(false)} className="p-3 rounded-lg border border-dashed border-border text-xs text-muted-foreground hover:text-foreground">
            Cancel
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowTemplates(true)}>
            <LayoutTemplate size={13} /> Templates
          </Button>
        </div>
      )}

      {/* Rule cards */}
      {rules.map((rule, idx) => (
        <div key={rule.id} className="border border-border rounded-lg bg-card/50 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <Badge variant="outline" className="text-[10px] font-mono">Rule {idx + 1}</Badge>
            {rules.length > 1 && (
              <button onClick={() => removeRule(rule.id)} className="p-1 text-muted-foreground/40 hover:text-destructive">
                <Trash2 size={12} />
              </button>
            )}
          </div>

          {/* WHEN */}
          <TriggerEditor
            trigger={rule.trigger}
            onChange={t => updateRule(rule.id, { trigger: t })}
            relayCount={relayCount}
            switchCount={switchCount}
            buttonCount={buttonCount}
            sensorKeys={sensorKeys}
          />

          {/* THEN */}
          {rule.actions.map((action, ai) => (
            <ActionEditor
              key={ai}
              action={action}
              relayCount={relayCount}
              onChange={a => {
                const next = [...rule.actions]
                next[ai] = a
                updateRule(rule.id, { actions: next })
              }}
              onRemove={rule.actions.length > 1 ? () => {
                updateRule(rule.id, { actions: rule.actions.filter((_, i) => i !== ai) })
              } : undefined}
            />
          ))}

          <button
            onClick={() => updateRule(rule.id, { actions: [...rule.actions, { type: 'relay', relay: 1, action: 'on' }] })}
            className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
          >
            <Plus size={11} /> Add action
          </button>
        </div>
      ))}

      {/* Add rule + Generate */}
      <div className="flex gap-2">
        <Button size="sm" variant="outline" className="gap-1.5" onClick={addRule}>
          <Plus size={13} /> Add rule
        </Button>
        <Button size="sm" className="gap-1.5 ml-auto" onClick={handleGenerate}>
          <Wand2 size={13} /> Generate
        </Button>
      </div>

      {/* Preview */}
      {rules.length > 0 && (
        <pre className="text-[11px] font-mono text-muted-foreground bg-muted/30 rounded-lg p-2 whitespace-pre-wrap">
          {buildRuleText(rules) || '(empty)'}
        </pre>
      )}
    </div>
  )
}

// ── Trigger Editor ───────────────────────────────────────────────────────────

function TriggerEditor({ trigger, onChange, relayCount, switchCount, buttonCount, sensorKeys }: {
  trigger: RuleTrigger
  onChange: (t: RuleTrigger) => void
  relayCount: number; switchCount: number; buttonCount: number; sensorKeys: string[]
}) {
  const nums = (n: number) => Array.from({ length: Math.max(n, 1) }, (_, i) => i + 1)

  return (
    <div className="flex items-center gap-2 flex-wrap text-xs">
      <span className="text-muted-foreground font-medium w-10 shrink-0">WHEN</span>

      <select
        value={trigger.type}
        onChange={e => {
          const type = e.target.value as RuleTrigger['type']
          if (type === 'relay')    onChange({ type, relay: 1, state: 'on' })
          if (type === 'sensor')   onChange({ type, sensor: sensorKeys[0] || 'AM2301#Temperature', op: '>', value: 25 })
          if (type === 'timer')    onChange({ type, timerNum: 1 })
          if (type === 'schedule') onChange({ type, minutes: 420 })
          if (type === 'system')   onChange({ type, event: 'boot' })
          if (type === 'switch')   onChange({ type, switchNum: 1, state: 'change' })
          if (type === 'button')   onChange({ type, buttonNum: 1, press: 'single' })
        }}
        className="h-7 rounded-md border border-input bg-background px-2 text-xs"
      >
        <option value="relay">Relay</option>
        <option value="sensor">Sensor</option>
        <option value="timer">Timer expires</option>
        <option value="schedule">Schedule</option>
        <option value="system">System event</option>
        {switchCount > 0 && <option value="switch">Switch</option>}
        {buttonCount > 0 && <option value="button">Button</option>}
      </select>

      {trigger.type === 'relay' && (
        <>
          <select value={trigger.relay} onChange={e => onChange({ ...trigger, relay: Number(e.target.value) })} className="h-7 rounded-md border border-input bg-background px-2 text-xs">
            {nums(relayCount).map(n => <option key={n} value={n}>Relay {n}</option>)}
          </select>
          <select value={trigger.state} onChange={e => onChange({ ...trigger, state: e.target.value as 'on'|'off'|'change' })} className="h-7 rounded-md border border-input bg-background px-2 text-xs">
            <option value="on">turns ON</option>
            <option value="off">turns OFF</option>
            <option value="change">changes</option>
          </select>
        </>
      )}

      {trigger.type === 'sensor' && (
        <>
          <select value={trigger.sensor} onChange={e => onChange({ ...trigger, sensor: e.target.value })} className="h-7 rounded-md border border-input bg-background px-2 text-xs">
            {sensorKeys.length > 0
              ? sensorKeys.map(k => <option key={k} value={k}>{k.split('.').pop() ?? k}</option>)
              : <option value="AM2301#Temperature">Temperature</option>
            }
          </select>
          <select value={trigger.op} onChange={e => onChange({ ...trigger, op: e.target.value as '>'|'<'|'=' })} className="h-7 w-12 rounded-md border border-input bg-background px-1 text-xs text-center">
            <option value=">">&gt;</option>
            <option value="<">&lt;</option>
            <option value="=">=</option>
            <option value=">=">&gt;=</option>
            <option value="<=">&lt;=</option>
          </select>
          <Input type="number" value={trigger.value} onChange={e => onChange({ ...trigger, value: Number(e.target.value) })} className="h-7 w-16 text-xs" />
        </>
      )}

      {trigger.type === 'timer' && (
        <select value={trigger.timerNum} onChange={e => onChange({ ...trigger, timerNum: Number(e.target.value) })} className="h-7 rounded-md border border-input bg-background px-2 text-xs">
          {Array.from({ length: 8 }, (_, i) => <option key={i+1} value={i+1}>RuleTimer {i+1}</option>)}
        </select>
      )}

      {trigger.type === 'schedule' && (
        <Input type="time" value={minutesToTime(trigger.minutes)} onChange={e => onChange({ ...trigger, minutes: timeToMinutes(e.target.value) })} className="h-7 w-28 text-xs" />
      )}

      {trigger.type === 'system' && (
        <select value={trigger.event} onChange={e => onChange({ ...trigger, event: e.target.value as 'boot'|'wifi_connected'|'mqtt_connected' })} className="h-7 rounded-md border border-input bg-background px-2 text-xs">
          <option value="boot">Boot</option>
          <option value="wifi_connected">WiFi connected</option>
          <option value="mqtt_connected">MQTT connected</option>
        </select>
      )}

      {trigger.type === 'switch' && (
        <>
          <select value={trigger.switchNum} onChange={e => onChange({ ...trigger, switchNum: Number(e.target.value) })} className="h-7 rounded-md border border-input bg-background px-2 text-xs">
            {nums(switchCount).map(n => <option key={n} value={n}>Switch {n}</option>)}
          </select>
          <select value={trigger.state} onChange={e => onChange({ ...trigger, state: e.target.value as 'on'|'off'|'change' })} className="h-7 rounded-md border border-input bg-background px-2 text-xs">
            <option value="on">ON</option>
            <option value="off">OFF</option>
            <option value="change">changes</option>
          </select>
        </>
      )}

      {trigger.type === 'button' && (
        <>
          <select value={trigger.buttonNum} onChange={e => onChange({ ...trigger, buttonNum: Number(e.target.value) })} className="h-7 rounded-md border border-input bg-background px-2 text-xs">
            {nums(buttonCount).map(n => <option key={n} value={n}>Button {n}</option>)}
          </select>
          <select value={trigger.press} onChange={e => onChange({ ...trigger, press: e.target.value as 'single'|'double'|'long' })} className="h-7 rounded-md border border-input bg-background px-2 text-xs">
            <option value="single">single press</option>
            <option value="double">double press</option>
            <option value="long">long press</option>
          </select>
        </>
      )}
    </div>
  )
}

// ── Action Editor ────────────────────────────────────────────────────────────

function ActionEditor({ action, relayCount, onChange, onRemove }: {
  action: RuleAction; relayCount: number
  onChange: (a: RuleAction) => void; onRemove?: () => void
}) {
  const nums = (n: number) => Array.from({ length: Math.max(n, 1) }, (_, i) => i + 1)

  return (
    <div className="flex items-center gap-2 flex-wrap text-xs">
      <span className="text-primary font-medium w-10 shrink-0">THEN</span>

      <select
        value={action.type}
        onChange={e => {
          const type = e.target.value as RuleAction['type']
          if (type === 'relay')   onChange({ type, relay: 1, action: 'on' })
          if (type === 'timer')   onChange({ type, timerNum: 1, seconds: 30 })
          if (type === 'publish') onChange({ type, topic: 'stat/%topic%/event', payload: 'triggered' })
          if (type === 'var')     onChange({ type, varNum: 1, value: '%value%' })
          if (type === 'delay')   onChange({ type, seconds: 5 })
        }}
        className="h-7 rounded-md border border-input bg-background px-2 text-xs"
      >
        <option value="relay">Set relay</option>
        <option value="timer">Start timer</option>
        <option value="delay">Delay</option>
        <option value="publish">MQTT publish</option>
        <option value="var">Set variable</option>
      </select>

      {action.type === 'relay' && (
        <>
          <select value={action.relay} onChange={e => onChange({ ...action, relay: Number(e.target.value) })} className="h-7 rounded-md border border-input bg-background px-2 text-xs">
            {nums(relayCount).map(n => <option key={n} value={n}>Relay {n}</option>)}
          </select>
          <select value={action.action} onChange={e => onChange({ ...action, action: e.target.value as 'on'|'off'|'toggle'|'follow' })} className="h-7 rounded-md border border-input bg-background px-2 text-xs">
            <option value="on">ON</option>
            <option value="off">OFF</option>
            <option value="toggle">TOGGLE</option>
            <option value="follow">follow trigger</option>
          </select>
        </>
      )}

      {action.type === 'timer' && (
        <>
          <select value={action.timerNum} onChange={e => onChange({ ...action, timerNum: Number(e.target.value) })} className="h-7 rounded-md border border-input bg-background px-2 text-xs">
            {Array.from({ length: 8 }, (_, i) => <option key={i+1} value={i+1}>RuleTimer {i+1}</option>)}
          </select>
          <Input type="number" min={1} max={65535} value={action.seconds} onChange={e => onChange({ ...action, seconds: Number(e.target.value) })} className="h-7 w-20 text-xs" />
          <span className="text-muted-foreground">sec</span>
        </>
      )}

      {action.type === 'delay' && (
        <>
          <Input type="number" min={1} max={3600} value={action.seconds} onChange={e => onChange({ ...action, seconds: Number(e.target.value) })} className="h-7 w-20 text-xs" />
          <span className="text-muted-foreground">sec</span>
        </>
      )}

      {action.type === 'publish' && (
        <>
          <Input value={action.topic} onChange={e => onChange({ ...action, topic: e.target.value })} placeholder="topic" className="h-7 flex-1 min-w-[120px] text-xs font-mono" />
          <Input value={action.payload} onChange={e => onChange({ ...action, payload: e.target.value })} placeholder="payload" className="h-7 w-24 text-xs font-mono" />
        </>
      )}

      {action.type === 'var' && (
        <>
          <select value={action.varNum} onChange={e => onChange({ ...action, varNum: Number(e.target.value) })} className="h-7 rounded-md border border-input bg-background px-2 text-xs">
            {Array.from({ length: 16 }, (_, i) => <option key={i+1} value={i+1}>Var{i+1}</option>)}
          </select>
          <Input value={action.value} onChange={e => onChange({ ...action, value: e.target.value })} placeholder="%value%" className="h-7 w-24 text-xs font-mono" />
        </>
      )}

      {onRemove && (
        <button onClick={onRemove} className="p-1 text-muted-foreground/40 hover:text-destructive">
          <Trash2 size={11} />
        </button>
      )}
    </div>
  )
}
