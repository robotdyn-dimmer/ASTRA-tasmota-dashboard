import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Plus, Pencil, Trash2, Zap, ArrowLeft, Clock, LayoutTemplate, AlertTriangle } from 'lucide-react'
import { useRuleStore } from '@/features/rules/store/rule-store'
import { useDeviceStore } from '@/features/devices/store/device-store'
import type { AutomationRule } from '../store/rule-store.types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { RuleEditor } from './RuleEditor'
import { RuleLogPanel } from './RuleLogPanel'
import { ScenarioTemplates } from './ScenarioTemplates'
import { triggerSummary } from './TriggerEditor'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatLastFired(ts?: number): string {
  if (!ts) return 'Never fired'
  const diff = Date.now() - ts
  if (diff < 60_000)  return 'Just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric' })
}

// ── Confirm delete ────────────────────────────────────────────────────────────

function DeleteConfirm({ name, onConfirm, onCancel }: { name: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="flex items-center gap-2 flex-wrap text-sm">
      <span className="text-muted-foreground">Delete <strong>{name}</strong>?</span>
      <Button
        size="sm"
        variant="destructive"
        className="h-7 text-xs"
        onClick={onConfirm}
      >
        Delete
      </Button>
      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onCancel}>
        Cancel
      </Button>
    </div>
  )
}

// ── RuleRow ───────────────────────────────────────────────────────────────────

function RuleRow({ rule, onEdit }: { rule: AutomationRule; onEdit: () => void }) {
  const enableRule = useRuleStore(s => s.enableRule)
  const deleteRule = useRuleStore(s => s.deleteRule)
  const devices    = useDeviceStore(s => s.devices)

  const [confirmDelete, setConfirmDelete] = useState(false)

  return (
    <div className={`border rounded-lg transition-colors ${
      rule.enabled ? 'border-primary/20 bg-card' : 'border-border bg-card/50'
    }`}>
      <div className="flex items-start gap-3 p-3">
        {/* Enable toggle */}
        <div className="pt-0.5 shrink-0">
          <Switch
            checked={rule.enabled}
            onCheckedChange={v => enableRule(rule.id, v)}
            aria-label={`${rule.enabled ? 'Disable' : 'Enable'} ${rule.name}`}
          />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 space-y-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`font-medium text-sm truncate ${rule.enabled ? 'text-foreground' : 'text-muted-foreground'}`}>
              {rule.name}
            </span>
            {rule.fireCount > 0 && (
              <Badge variant="secondary" className="text-xs shrink-0">
                {rule.fireCount}× fired
              </Badge>
            )}
          </div>

          {rule.description && (
            <p className="text-xs text-muted-foreground truncate">{rule.description}</p>
          )}

          <div className="flex items-center gap-3 flex-wrap mt-1">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Zap size={11} />
              {triggerSummary(rule.trigger, devices)}
            </span>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock size={11} />
              {formatLastFired(rule.lastFiredAt)}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
            onClick={onEdit}
            aria-label="Edit rule"
          >
            <Pencil size={14} />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
            onClick={() => setConfirmDelete(true)}
            aria-label="Delete rule"
          >
            <Trash2 size={14} />
          </Button>
        </div>
      </div>

      {/* Confirm delete row */}
      {confirmDelete && (
        <div className="border-t border-border px-3 py-2 bg-destructive/5">
          <DeleteConfirm
            name={rule.name}
            onConfirm={() => {
              deleteRule(rule.id)
              setConfirmDelete(false)
            }}
            onCancel={() => setConfirmDelete(false)}
          />
        </div>
      )}
    </div>
  )
}

// ── RulesPage ─────────────────────────────────────────────────────────────────

interface RulesPageProps {
  newRule?: boolean
}

export function RulesPage({ newRule }: RulesPageProps) {
  const { ruleId } = useParams<{ ruleId: string }>()
  const navigate   = useNavigate()
  const [showTemplates, setShowTemplates] = useState(true)
  const [templateInit, setTemplateInit]   = useState<Partial<Omit<AutomationRule,'id'|'createdAt'|'updatedAt'|'fireCount'>> | undefined>()

  const rules = useRuleStore(s => s.rules)
  const ruleList = Object.values(rules)
  const activeCount = ruleList.filter(r => r.enabled).length

  // Show editor if we have a ruleId param or newRule prop
  const showEditor = newRule || Boolean(ruleId)
  const editingId  = ruleId  // undefined if new

  function handleClose() {
    setShowTemplates(true)
    setTemplateInit(undefined)
    navigate('/rules')
  }

  // ── Editor view ──────────────────────────────────────────────────────────

  if (showEditor) {
    // For new rules: first show template picker
    if (newRule && showTemplates) {
      return (
        <div className="space-y-4 max-w-3xl">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" className="gap-1.5" onClick={handleClose}>
              <ArrowLeft size={15} /> Automations
            </Button>
          </div>
          <ScenarioTemplates
            onSelect={(partial) => {
              setTemplateInit(partial)
              setShowTemplates(false)
            }}
            onClose={() => setShowTemplates(false)}
          />
        </div>
      )
    }

    return (
      <div className="space-y-4 max-w-3xl">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" className="gap-1.5" onClick={handleClose}>
            <ArrowLeft size={15} /> Automations
          </Button>
          {newRule && !editingId && (
            <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={() => setShowTemplates(true)}>
              <LayoutTemplate size={14} /> Templates
            </Button>
          )}
        </div>
        <RuleEditor ruleId={editingId} initialValues={templateInit} onClose={handleClose} />
      </div>
    )
  }

  // ── List view ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4 max-w-3xl">

      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Zap size={18} className="text-primary" />
          <h2 className="text-xl font-semibold">Automations</h2>
        </div>
        {ruleList.length > 0 && (
          <Badge variant="secondary" className="text-xs">
            {activeCount} of {ruleList.length} active
          </Badge>
        )}
        <div className="ml-auto">
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => navigate('/rules/new')}
          >
            <Plus size={14} />
            New Rule
          </Button>
        </div>
      </div>

      {/* Browser-only warning */}
      <div className="flex items-start gap-3 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-sm">
        <AlertTriangle size={18} className="text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5" />
        <div>
          <p className="font-medium text-yellow-700 dark:text-yellow-300">Browser-only automations</p>
          <p className="text-muted-foreground text-xs mt-0.5">
            Rules run only while this app is open. For permanent schedules, use device Timers or Tasmota Rules.
          </p>
        </div>
      </div>

      <Separator />

      {/* Empty state */}
      {ruleList.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
            <Zap size={26} className="text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <h3 className="font-semibold text-foreground">No automations yet</h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              Create rules to automate your devices based on triggers, schedules, or sensor readings.
            </p>
          </div>
          <Button
            onClick={() => navigate('/rules/new')}
            className="gap-1.5"
          >
            <Plus size={14} />
            Create your first rule
          </Button>
        </div>
      ) : (
        <>
          {/* Rule list */}
          <div className="space-y-2">
            {ruleList
              .sort((a, b) => b.updatedAt - a.updatedAt)
              .map(rule => (
                <RuleRow
                  key={rule.id}
                  rule={rule}
                  onEdit={() => navigate(`/rules/${rule.id}`)}
                />
              ))
            }
          </div>

          <Separator />

          {/* Log panel */}
          <RuleLogPanel />
        </>
      )}
    </div>
  )
}
