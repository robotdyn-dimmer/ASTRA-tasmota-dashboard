/**
 * tasmota-rule-builder.ts — generates Tasmota rule text from visual rule model.
 *
 * One-way: VisualRule[] → text string. No reverse parsing.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface VisualRule {
  id: string
  trigger: RuleTrigger
  actions: RuleAction[]
}

export type RuleTrigger =
  | { type: 'relay';    relay: number; state: 'on' | 'off' | 'change' }
  | { type: 'sensor';   sensor: string; op: '>' | '<' | '=' | '>=' | '<='; value: number }
  | { type: 'timer';    timerNum: number }
  | { type: 'schedule'; minutes: number }
  | { type: 'system';   event: 'boot' | 'wifi_connected' | 'mqtt_connected' }
  | { type: 'switch';   switchNum: number; state: 'on' | 'off' | 'change' }
  | { type: 'button';   buttonNum: number; press: 'single' | 'double' | 'long' }

export type RuleAction =
  | { type: 'relay';   relay: number; action: 'on' | 'off' | 'toggle' | 'follow' }
  | { type: 'timer';   timerNum: number; seconds: number }
  | { type: 'publish'; topic: string; payload: string }
  | { type: 'var';     varNum: number; value: string }
  | { type: 'delay';   seconds: number }

// ── Defaults ─────────────────────────────────────────────────────────────────

export const DEFAULT_TRIGGER: RuleTrigger = { type: 'relay', relay: 1, state: 'on' }
export const DEFAULT_ACTION: RuleAction = { type: 'relay', relay: 1, action: 'on' }

export function createVisualRule(): VisualRule {
  return { id: crypto.randomUUID(), trigger: { ...DEFAULT_TRIGGER }, actions: [{ ...DEFAULT_ACTION }] }
}

// ── Templates ────────────────────────────────────────────────────────────────

export interface RuleTemplate {
  name: string
  description: string
  rules: VisualRule[]
}

export const RULE_TEMPLATES: RuleTemplate[] = [
  {
    name: 'Auto-off timer',
    description: 'Turn relay off automatically after N seconds',
    rules: [
      { id: '1', trigger: { type: 'relay', relay: 1, state: 'on' }, actions: [{ type: 'timer', timerNum: 1, seconds: 30 }] },
      { id: '2', trigger: { type: 'timer', timerNum: 1 }, actions: [{ type: 'relay', relay: 1, action: 'off' }] },
    ],
  },
  {
    name: 'Relay mirror',
    description: 'Relay 2 follows Relay 1 state',
    rules: [
      { id: '1', trigger: { type: 'relay', relay: 1, state: 'change' }, actions: [{ type: 'relay', relay: 2, action: 'follow' }] },
    ],
  },
  {
    name: 'Thermostat',
    description: 'Relay ON below threshold, OFF above',
    rules: [
      { id: '1', trigger: { type: 'sensor', sensor: 'AM2301#Temperature', op: '<', value: 20 }, actions: [{ type: 'relay', relay: 1, action: 'on' }] },
      { id: '2', trigger: { type: 'sensor', sensor: 'AM2301#Temperature', op: '>', value: 25 }, actions: [{ type: 'relay', relay: 1, action: 'off' }] },
    ],
  },
  {
    name: 'Schedule ON/OFF',
    description: 'Turn on at morning, off at night',
    rules: [
      { id: '1', trigger: { type: 'schedule', minutes: 420 }, actions: [{ type: 'relay', relay: 1, action: 'on' }] },
      { id: '2', trigger: { type: 'schedule', minutes: 1380 }, actions: [{ type: 'relay', relay: 1, action: 'off' }] },
    ],
  },
  {
    name: 'Switch controls relay',
    description: 'Physical switch mirrors relay state',
    rules: [
      { id: '1', trigger: { type: 'switch', switchNum: 1, state: 'change' }, actions: [{ type: 'relay', relay: 1, action: 'follow' }] },
    ],
  },
]

// ── Text Generation ──────────────────────────────────────────────────────────

function buildTrigger(t: RuleTrigger): string {
  switch (t.type) {
    case 'relay':
      if (t.state === 'change') return `Power${t.relay}#State`
      return `Power${t.relay}#State=${t.state === 'on' ? '1' : '0'}`
    case 'sensor':
      return `${t.sensor}${t.op}${t.value}`
    case 'timer':
      return `Rules#Timer=${t.timerNum}`
    case 'schedule':
      return `Time#Minute=${t.minutes}`
    case 'system':
      if (t.event === 'boot') return 'System#Boot'
      if (t.event === 'wifi_connected') return 'Wifi#Connected'
      return 'Mqtt#Connected'
    case 'switch':
      if (t.state === 'change') return `Switch${t.switchNum}#State`
      return `Switch${t.switchNum}#State=${t.state === 'on' ? '1' : '0'}`
    case 'button': {
      const pressMap = { single: '1', double: '2', long: '3' }
      return `Button${t.buttonNum}#State=${pressMap[t.press]}`
    }
  }
}

function buildAction(a: RuleAction): string {
  switch (a.type) {
    case 'relay':
      if (a.action === 'follow') return `Power${a.relay} %value%`
      if (a.action === 'toggle') return `Power${a.relay} TOGGLE`
      return `Power${a.relay} ${a.action === 'on' ? '1' : '0'}`
    case 'timer':
      return `RuleTimer${a.timerNum} ${a.seconds}`
    case 'publish':
      return `Publish ${a.topic} ${a.payload}`
    case 'var':
      return `Var${a.varNum} ${a.value}`
    case 'delay':
      return `Delay ${a.seconds * 10}` // Tasmota Delay is in 0.1s units
  }
}

export function buildRuleText(rules: VisualRule[]): string {
  return rules.map(rule => {
    const trigger = buildTrigger(rule.trigger)
    const actions = rule.actions.filter(a => {
      if (a.type === 'publish' && !a.topic) return false
      return true
    })
    if (actions.length === 0) return ''
    const command = actions.length > 1
      ? `Backlog ${actions.map(buildAction).join('; ')}`
      : buildAction(actions[0])
    return `ON ${trigger} DO ${command} ENDON`
  }).filter(Boolean).join('\n')
}

// ── Helpers for UI ───────────────────────────────────────────────────────────

export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}
