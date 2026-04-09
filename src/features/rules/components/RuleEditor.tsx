import { useState } from 'react'
import { AlertCircle, Save, X, Plus } from 'lucide-react'
import { useRuleStore } from '@/features/rules/store/rule-store'
import { useDeviceStore } from '@/features/devices/store/device-store'
import type { AutomationRule, RuleTrigger, RuleCondition, RuleAction } from '@/features/rules/store/rule-store.types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { TriggerEditor } from './TriggerEditor'
import { ConditionEditor, defaultCondition } from './ConditionEditor'
import { ActionEditor, defaultAction } from './ActionEditor'

// ── Default values ────────────────────────────────────────────────────────────

const DEFAULT_TRIGGER: RuleTrigger = { type: 'sensor-threshold', deviceId: '', sensorKey: '', operator: '>', value: 0 }

function makeDefaultRule(): Omit<AutomationRule, 'id' | 'createdAt' | 'updatedAt' | 'fireCount'> {
  return {
    name:        '',
    description: '',
    enabled:     true,
    trigger:     DEFAULT_TRIGGER,
    conditions:  [],
    actions:     [],
    cooldownMs:  undefined,
  }
}

// ── Validation ────────────────────────────────────────────────────────────────

interface FormErrors {
  name?:    string
  trigger?: string
  actions?: string
}

function validate(draft: ReturnType<typeof makeDefaultRule>): FormErrors {
  const errors: FormErrors = {}
  if (!draft.name.trim())    errors.name    = 'Name is required'
  if (draft.actions.length === 0) errors.actions = 'At least one action is required'
  return errors
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionHeader({ title, badge, action }: { title: string; badge?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {badge && <Badge variant="secondary" className="text-xs">{badge}</Badge>}
      {action && <div className="ml-auto">{action}</div>}
    </div>
  )
}

// ── RuleEditor ────────────────────────────────────────────────────────────────

interface RuleEditorProps {
  ruleId?:        string
  initialValues?: Partial<Omit<AutomationRule, 'id' | 'createdAt' | 'updatedAt' | 'fireCount'>>
  onClose:        () => void
}

export function RuleEditor({ ruleId, initialValues, onClose }: RuleEditorProps) {
  const addRule    = useRuleStore(s => s.addRule)
  const updateRule = useRuleStore(s => s.updateRule)
  const existingRule = useRuleStore(s => ruleId ? s.rules[ruleId] : undefined)
  const allRules   = useRuleStore(s => s.rules)

  const devices      = useDeviceStore(s => s.devices)
  const deviceStates = useDeviceStore(s => s.deviceStates)

  const isNew = !ruleId

  // Initialise draft from existing rule or defaults
  const [draft, setDraft] = useState<Omit<AutomationRule, 'id' | 'createdAt' | 'updatedAt' | 'fireCount'>>(() => {
    if (existingRule) {
      const { id: _id, createdAt: _c, updatedAt: _u, fireCount: _f, ...rest } = existingRule
      return rest
    }
    if (initialValues) {
      return { ...makeDefaultRule(), ...initialValues }
    }
    return makeDefaultRule()
  })

  const [errors, setErrors]   = useState<FormErrors>({})
  const [saving, setSaving]   = useState(false)

  // Cooldown displayed in seconds
  const cooldownSec = draft.cooldownMs != null ? draft.cooldownMs / 1000 : 0

  function patchDraft(partial: Partial<typeof draft>) {
    setDraft(prev => ({ ...prev, ...partial }))
    // Clear relevant errors
    if (partial.name !== undefined && errors.name) setErrors(e => ({ ...e, name: undefined }))
    if (partial.actions !== undefined && errors.actions) setErrors(e => ({ ...e, actions: undefined }))
  }

  function handleSave() {
    const errs = validate(draft)
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }
    setSaving(true)
    try {
      if (isNew) {
        addRule(draft)
      } else if (ruleId) {
        updateRule(ruleId, draft)
      }
      onClose()
    } finally {
      setSaving(false)
    }
  }

  // Condition helpers
  function addCondition() {
    patchDraft({ conditions: [...draft.conditions, defaultCondition('device-online')] })
  }
  function updateCondition(idx: number, c: RuleCondition) {
    const conditions = [...draft.conditions]
    conditions[idx] = c
    patchDraft({ conditions })
  }
  function removeCondition(idx: number) {
    patchDraft({ conditions: draft.conditions.filter((_, i) => i !== idx) })
  }

  // Action helpers
  function addAction() {
    patchDraft({ actions: [...draft.actions, defaultAction('tasmota-command')] })
    if (errors.actions) setErrors(e => ({ ...e, actions: undefined }))
  }
  function updateAction(idx: number, a: RuleAction) {
    const actions = [...draft.actions]
    actions[idx] = a
    patchDraft({ actions })
  }
  function removeAction(idx: number) {
    patchDraft({ actions: draft.actions.filter((_, i) => i !== idx) })
  }
  function moveAction(idx: number, dir: 'up' | 'down') {
    const actions = [...draft.actions]
    const target = dir === 'up' ? idx - 1 : idx + 1
    if (target < 0 || target >= actions.length) return
    ;[actions[idx], actions[target]] = [actions[target], actions[idx]]
    patchDraft({ actions })
  }

  // AND/OR toggle label
  const conditionLogic = 'All conditions must pass (AND)'

  return (
    <div className="space-y-0 max-w-3xl">

      {/* ── Page header ── */}
      <div className="flex items-center gap-3 pb-4">
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold">{isNew ? 'New Automation' : 'Edit Automation'}</h2>
          <p className="text-sm text-muted-foreground">
            {isNew ? 'Configure when and what to do' : existingRule?.name}
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0">
          <X size={18} />
        </Button>
      </div>

      <Separator />

      {/* ── Section 1: Basic info ── */}
      <div className="py-5 space-y-3">
        <SectionHeader title="Basic Info" />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="rule-name" className="text-xs">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="rule-name"
              value={draft.name}
              onChange={e => patchDraft({ name: e.target.value })}
              placeholder="E.g. High Temperature Alert"
              className={`h-9 text-sm ${errors.name ? 'border-destructive' : ''}`}
            />
            {errors.name && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle size={11} /> {errors.name}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="rule-desc" className="text-xs">Description</Label>
            <Input
              id="rule-desc"
              value={draft.description ?? ''}
              onChange={e => patchDraft({ description: e.target.value || undefined })}
              placeholder="Optional description"
              className="h-9 text-sm"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="rule-cooldown" className="text-xs">
              Cooldown (seconds)
            </Label>
            <Input
              id="rule-cooldown"
              type="number"
              min={0}
              value={cooldownSec}
              onChange={e => {
                const sec = Number(e.target.value)
                patchDraft({ cooldownMs: sec > 0 ? sec * 1000 : undefined })
              }}
              placeholder="0 = no cooldown"
              className="h-9 text-sm"
            />
            <p className="text-xs text-muted-foreground">Minimum time between firings. 0 = no limit.</p>
          </div>
        </div>
      </div>

      <Separator />

      {/* ── Section 2: WHEN (Trigger) ── */}
      <div className="py-5 space-y-3">
        <SectionHeader title="WHEN — Trigger" />
        <TriggerEditor
          trigger={draft.trigger}
          onChange={t => patchDraft({ trigger: t })}
          devices={devices}
        />
      </div>

      <Separator />

      {/* ── Section 3: IF (Conditions) ── */}
      <div className="py-5 space-y-3">
        <SectionHeader
          title="IF — Conditions"
          badge={draft.conditions.length > 0 ? String(draft.conditions.length) : undefined}
          action={
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 gap-1.5 text-xs"
              onClick={addCondition}
            >
              <Plus size={12} /> Add condition
            </Button>
          }
        />

        {draft.conditions.length === 0 ? (
          <div className="flex items-center gap-2 p-4 rounded-lg bg-muted/40 border border-dashed border-border">
            <p className="text-sm text-muted-foreground">
              No conditions — rule fires on trigger alone
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {draft.conditions.length > 1 && (
              <p className="text-xs text-muted-foreground pb-1">{conditionLogic}</p>
            )}
            {draft.conditions.map((c, idx) => (
              <ConditionEditor
                key={idx}
                condition={c}
                onChange={updated => updateCondition(idx, updated)}
                onRemove={() => removeCondition(idx)}
                devices={devices}
                deviceStates={deviceStates}
              />
            ))}
          </div>
        )}
      </div>

      <Separator />

      {/* ── Section 4: THEN (Actions) ── */}
      <div className="py-5 space-y-3">
        <SectionHeader
          title="THEN — Actions"
          badge={draft.actions.length > 0 ? String(draft.actions.length) : undefined}
          action={
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 gap-1.5 text-xs"
              onClick={addAction}
            >
              <Plus size={12} /> Add action
            </Button>
          }
        />

        {errors.actions && (
          <p className="text-xs text-destructive flex items-center gap-1">
            <AlertCircle size={11} /> {errors.actions}
          </p>
        )}

        {draft.actions.length === 0 ? (
          <div className="flex items-center gap-2 p-4 rounded-lg bg-muted/40 border border-dashed border-border">
            <p className="text-sm text-muted-foreground">
              No actions — click "+ Add action" above
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {draft.actions.map((a, idx) => (
              <ActionEditor
                key={idx}
                action={a}
                onChange={updated => updateAction(idx, updated)}
                onRemove={() => removeAction(idx)}
                onMoveUp={() => moveAction(idx, 'up')}
                onMoveDown={() => moveAction(idx, 'down')}
                isFirst={idx === 0}
                isLast={idx === draft.actions.length - 1}
                devices={devices}
                rules={allRules}
                selfRuleId={ruleId}
              />
            ))}
          </div>
        )}
      </div>

      <Separator />

      {/* ── Footer ── */}
      <div className="flex items-center gap-3 pt-4 pb-2">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="gap-1.5"
        >
          <Save size={14} />
          {isNew ? 'Create Rule' : 'Save Changes'}
        </Button>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
