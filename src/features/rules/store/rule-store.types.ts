// ── Triggers ──────────────────────────────────────────────────────────────────

export type TriggerOperator = '>' | '<' | '>=' | '<=' | '==' | '!='

export interface SensorThresholdTrigger {
  type:        'sensor-threshold'
  deviceId:    string
  sensorKey:   string        // e.g. "AM2301.Temperature"
  operator:    TriggerOperator
  value:       number
  hysteresis?: number        // dead-band to prevent flapping
}

export interface PowerChangeTrigger {
  type:     'power-change'
  deviceId: string
  relay:    string           // "POWER" | "POWER1" | "POWER2"
  to:       'ON' | 'OFF' | 'any'
}

export interface DeviceOnlineTrigger {
  type:     'device-online'
  deviceId: string
  to:       'online' | 'offline'
}

export interface MqttMessageTrigger {
  type:          'mqtt-message'
  topicPattern:  string      // supports + and # wildcards
  payloadMatch?: string      // optional regex against raw payload string
}

export interface TimeCronTrigger {
  type:      'time-cron'
  cron:      string          // 5-field cron: "0 7 * * 1-5"
  timezone?: string
}

export interface TimeIntervalTrigger {
  type:       'time-interval'
  intervalMs: number         // minimum 10 000 ms enforced
}

export type RuleTrigger =
  | SensorThresholdTrigger
  | PowerChangeTrigger
  | DeviceOnlineTrigger
  | MqttMessageTrigger
  | TimeCronTrigger
  | TimeIntervalTrigger

// ── Conditions ────────────────────────────────────────────────────────────────

export interface SensorCompareCondition {
  type:               'sensor-compare'
  deviceId:           string
  sensorKey:          string
  operator:           TriggerOperator
  compareToLiteral?:  number
  compareToSensor?:   { deviceId: string; sensorKey: string }
}

export interface PowerStateCondition {
  type:     'power-state'
  deviceId: string
  relay:    string
  state:    'ON' | 'OFF'
}

export interface DeviceOnlineCondition {
  type:     'device-online'
  deviceId: string
  state:    'online' | 'offline'
}

export interface TimeRangeCondition {
  type: 'time-range'
  from: string    // "HH:MM"
  to:   string    // "HH:MM"
}

export interface DayOfWeekCondition {
  type: 'day-of-week'
  days: number[]  // 0=Sun … 6=Sat
}

export interface AndCondition {
  type:       'and'
  conditions: RuleCondition[]
}

export interface OrCondition {
  type:       'or'
  conditions: RuleCondition[]
}

export interface NotCondition {
  type:      'not'
  condition: RuleCondition
}

export type RuleCondition =
  | SensorCompareCondition
  | PowerStateCondition
  | DeviceOnlineCondition
  | TimeRangeCondition
  | DayOfWeekCondition
  | AndCondition
  | OrCondition
  | NotCondition

// ── Actions ───────────────────────────────────────────────────────────────────

export type ActionTransport = 'mqtt' | 'http' | 'auto'

export interface TasmotaCommandAction {
  type:           'tasmota-command'
  targetDeviceId: string
  command:        string       // supports {{trigger.value}} template vars
  transport:      ActionTransport
}

export interface RelaySetAction {
  type:           'relay-set'
  targetDeviceId: string
  relay:          string       // "POWER" | "POWER1" | "POWER2"
  state:          'ON' | 'OFF' | 'TOGGLE'
  transport:      ActionTransport
}

export interface MqttPublishAction {
  type:     'mqtt-publish'
  topic:    string             // supports template vars
  payload:  string
  retain?:  boolean
  qos?:     0 | 1 | 2
}

export interface DelayAction {
  type:       'delay'
  durationMs: number           // max 300 000 (5 min)
}

export interface NotificationAction {
  type:  'notification'
  title: string
  body:  string                // supports template vars
}

export interface HttpRequestAction {
  type:     'http-request'
  url:      string             // supports template vars
  method:   'GET' | 'POST'
  body?:    string
  headers?: Record<string, string>
}

export interface RunRuleAction {
  type:   'run-rule'
  ruleId: string
}

export type RuleAction =
  | TasmotaCommandAction
  | RelaySetAction
  | MqttPublishAction
  | DelayAction
  | NotificationAction
  | HttpRequestAction
  | RunRuleAction

// ── Rule ──────────────────────────────────────────────────────────────────────

export interface AutomationRule {
  id:          string          // "rule_<timestamp>"
  name:        string
  description?: string
  enabled:     boolean
  trigger:     RuleTrigger
  conditions:  RuleCondition[] // all must pass (implicit AND at top level)
  actions:     RuleAction[]    // executed sequentially
  cooldownMs?: number          // minimum ms between firings
  lastFiredAt?: number
  fireCount:   number
  createdAt:   number
  updatedAt:   number
}

// ── Log ───────────────────────────────────────────────────────────────────────

export interface RuleLogEntry {
  id:               string
  ruleId:           string
  ruleName:         string
  firedAt:          number
  triggerSummary?:  string
  actionsExecuted:  number
  error?:           string
}

// ── Store State ───────────────────────────────────────────────────────────────

export interface RuleStoreState {
  rules:   Record<string, AutomationRule>
  log:     RuleLogEntry[]    // last 100 entries, not persisted

  addRule:    (rule: Omit<AutomationRule, 'id' | 'createdAt' | 'updatedAt' | 'fireCount'>) => string
  updateRule: (id: string, partial: Partial<AutomationRule>) => void
  deleteRule: (id: string) => void
  enableRule: (id: string, enabled: boolean) => void
  appendLog:  (entry: RuleLogEntry) => void
  clearLog:   () => void
}

// ── Engine Context ────────────────────────────────────────────────────────────

export interface EvaluationContext {
  deviceStates: Record<string, import('@/features/devices/store/device-store.types').DeviceState>
  currentTime:  Date
}

export interface ActionContext extends EvaluationContext {
  triggerValue?:  unknown    // the value that caused the trigger
  triggerDevice?: string     // deviceId that fired the trigger
  depth:          number     // recursion depth for run-rule, max 5
}
