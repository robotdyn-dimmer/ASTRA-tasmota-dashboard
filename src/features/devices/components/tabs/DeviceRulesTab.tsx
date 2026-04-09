/**
 * DeviceRulesTab — view and edit Tasmota device-level rules (Rule1/Rule2/Rule3).
 *
 * Tasmota Rules run on the ESP32 itself — always active, no browser required.
 * Up to 3 rule sets (Rule1, Rule2, Rule3), each max 511 characters.
 *
 * HTTP API:
 *   GET  /cm?cmnd=Rule1         → read current Rule1
 *   GET  /cm?cmnd=Rule1 <text>  → set Rule1 content
 *   GET  /cm?cmnd=Rule1 1       → enable Rule1
 *   GET  /cm?cmnd=Rule1 0       → disable Rule1
 */

import { useState, useEffect, useCallback } from 'react'
import { BookOpen, ChevronDown, ChevronUp, Loader2, Save, Power, Trash2, RefreshCw, Eye, Code } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { tasmotaHttp } from '@/core/http/tasmota-http-client'
import { useDeviceStore } from '@/features/devices/store/device-store'
import { RuleVisualBuilder } from './RuleVisualBuilder'
import type { TasmotaDevice } from '@/features/devices/store/device-store.types'

const MAX_RULE_LENGTH = 511
const RULE_INDICES    = [1, 2, 3] as const

interface RuleState {
  text:    string   // raw rule text from device
  enabled: boolean
}

interface Props {
  device: TasmotaDevice
}

// ── Rule docs (collapsible reference) ────────────────────────────────────────

const DOCS = `Syntax:  ON <trigger> DO <command> ENDON
Multiple rules in one set, separated by new lines or spaces.

Trigger examples:
  AM2301#Temperature>28     sensor threshold
  Power1#State=1            relay turned ON
  Clock#Timer=1             cron timer (Timer1)
  System#Boot               on device startup
  Mqtt#Connected            on MQTT connect
  Time#Initialized          after time sync

Command examples:
  Power1 ON          turn relay ON
  Power1 OFF         turn relay OFF
  Power1 TOGGLE      toggle relay
  Publish stat/%topic%/custom <payload>   MQTT publish
  Var1 %value%       store value in variable
  Delay 50           wait 500ms (units = 0.1s)
  Backlog Power1 ON; Delay 20; Power1 OFF  sequence

Variables:
  %value%      current trigger value
  %topic%      device MQTT topic
  Var1..Var16  persistent variables
`

export function DeviceRulesTab({ device }: Props) {
  const [rules,     setRules]     = useState<Record<number, RuleState>>({})
  const [loading,   setLoading]   = useState(false)
  const [saving,    setSaving]    = useState<Record<number, boolean>>({})
  const [error,     setError]     = useState<string | null>(null)
  const [docsOpen,  setDocsOpen]  = useState(false)
  const [visualMode, setVisualMode] = useState<Record<number, boolean>>({})
  const deviceState = useDeviceStore(s => s.deviceStates[device.id])
  const relayCount = Object.keys(deviceState?.power ?? {}).length || 1
  const sensorKeys = Object.keys(deviceState?.sensors ?? {}).map(k => k.replace('.', '#'))
  const gpioConfig = deviceState?.gpioConfig ?? []
  const switchCount = gpioConfig.filter(g => g.entityType === 'switch_input').length
  const buttonCount = gpioConfig.filter(g => g.entityType === 'button').length

  // ── Load rules from device ──────────────────────────────────────────────────

  const loadRules = useCallback(async () => {
    if (!device.ipAddress) return
    setLoading(true)
    setError(null)

    const loaded: Record<number, RuleState> = {}

    await Promise.allSettled(
      RULE_INDICES.map(async (n) => {
        try {
          const result = await tasmotaHttp.sendCommand(device.ipAddress!, `Rule${n}`)
          if (!result.ok) return

          // Tasmota <13: {"Rule1":"1 ON ... ENDON"}  first char = enable state
          // Tasmota 15+: {"Rule1":{"State":"ON","Once":"OFF","StopOnError":"OFF","Length":12,"Free":499,"Rules":"ON ..."}}
          const data    = result.data as Record<string, unknown>
          const val     = data[`Rule${n}`]

          let enabled = false
          let text    = ''

          if (typeof val === 'object' && val !== null) {
            // Tasmota 15.x structured response
            const obj = val as Record<string, unknown>
            enabled = String(obj.State ?? '').toUpperCase() === 'ON'
            text    = String(obj.Rules ?? '').trim()
          } else {
            // Older firmware: string starting with '0' or '1'
            const raw = String(val ?? '')
            enabled   = raw.startsWith('1')
            text      = raw.length > 2 ? raw.slice(2).trim() : ''
          }

          loaded[n] = { text, enabled }
        } catch {
          loaded[n] = { text: '', enabled: false }
        }
      })
    )

    setRules(loaded)
    setLoading(false)
  }, [device.ipAddress])

  useEffect(() => { loadRules() }, [loadRules])

  // ── Save a single rule ──────────────────────────────────────────────────────

  const saveRule = async (n: number) => {
    if (!device.ipAddress) return
    setSaving(prev => ({ ...prev, [n]: true }))
    setError(null)

    const rule = rules[n]
    if (!rule) return

    try {
      // Set content (empty string clears the rule)
      const text = rule.text.trim()
      await tasmotaHttp.sendCommand(device.ipAddress, `Rule${n} ${text}`)

      // Set enabled/disabled state
      await tasmotaHttp.sendCommand(device.ipAddress, `Rule${n} ${rule.enabled ? '1' : '0'}`)
    } catch (err) {
      setError(`Failed to save Rule${n}: ${err instanceof Error ? err.message : 'unknown error'}`)
    } finally {
      setSaving(prev => ({ ...prev, [n]: false }))
    }
  }

  // ── Toggle enabled state ────────────────────────────────────────────────────

  const toggleEnabled = async (n: number) => {
    if (!device.ipAddress) return
    const rule = rules[n]
    if (!rule) return

    const newEnabled = !rule.enabled
    setRules(prev => ({ ...prev, [n]: { ...prev[n], enabled: newEnabled } }))

    try {
      await tasmotaHttp.sendCommand(device.ipAddress, `Rule${n} ${newEnabled ? '1' : '0'}`)
    } catch {
      // Revert on error
      setRules(prev => ({ ...prev, [n]: { ...prev[n], enabled: !newEnabled } }))
    }
  }

  // ── Clear rule ──────────────────────────────────────────────────────────────

  const clearRule = (n: number) => {
    setRules(prev => ({ ...prev, [n]: { text: '', enabled: false } }))
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (!device.ipAddress) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          IP address required to read/write device rules.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">

      {/* ── Header row ── */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Rules run on the device — active even when this app is closed.
        </p>
        <Button variant="outline" size="sm" onClick={loadRules} disabled={loading} className="gap-1.5 shrink-0">
          {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
          Reload
        </Button>
      </div>

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {/* ── Rule editors ── */}
      {RULE_INDICES.map(n => {
        const rule     = rules[n] ?? { text: '', enabled: false }
        const charCount = rule.text.length
        const overLimit = charCount > MAX_RULE_LENGTH
        const hasContent = rule.text.trim().length > 0

        return (
          <Card key={n}>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold">Rule {n}</span>

                {/* Enabled toggle */}
                <Button
                  size="sm"
                  variant={rule.enabled ? 'default' : 'outline'}
                  className="h-6 px-2 text-xs gap-1"
                  onClick={() => toggleEnabled(n)}
                  disabled={!hasContent}
                  title={rule.enabled ? 'Disable rule' : 'Enable rule'}
                >
                  <Power size={11} />
                  {rule.enabled ? 'ON' : 'OFF'}
                </Button>

                <div className="flex-1" />

                {/* Visual/Text toggle */}
                <div className="flex rounded-md border border-input overflow-hidden">
                  <button
                    onClick={() => setVisualMode(prev => ({ ...prev, [n]: true }))}
                    className={`h-6 px-2 text-[11px] flex items-center gap-1 transition-colors ${visualMode[n] ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted'}`}
                  >
                    <Eye size={11} /> Visual
                  </button>
                  <button
                    onClick={() => setVisualMode(prev => ({ ...prev, [n]: false }))}
                    className={`h-6 px-2 text-[11px] flex items-center gap-1 transition-colors ${!visualMode[n] ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted'}`}
                  >
                    <Code size={11} /> Text
                  </button>
                </div>

                {/* Char counter */}
                <Badge variant={overLimit ? 'destructive' : 'secondary'} className="text-xs font-mono">
                  {charCount}/{MAX_RULE_LENGTH}
                </Badge>

                {/* Clear */}
                {hasContent && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-muted-foreground hover:text-destructive"
                    onClick={() => clearRule(n)}
                    title="Clear rule"
                  >
                    <Trash2 size={12} />
                  </Button>
                )}

                {/* Save */}
                <Button
                  size="sm"
                  className="h-7 px-3 gap-1.5"
                  onClick={() => saveRule(n)}
                  disabled={saving[n] || overLimit}
                >
                  {saving[n]
                    ? <Loader2 size={12} className="animate-spin" />
                    : <Save size={12} />}
                  Save
                </Button>
              </div>
            </CardHeader>

            <CardContent className="pt-0">
              {visualMode[n] ? (
                <RuleVisualBuilder
                  sensorKeys={sensorKeys}
                  relayCount={relayCount}
                  switchCount={switchCount}
                  buttonCount={buttonCount}
                  onGenerate={(text) => {
                    setRules(prev => ({ ...prev, [n]: { ...prev[n], text } }))
                    setVisualMode(prev => ({ ...prev, [n]: false }))
                  }}
                />
              ) : (
                <textarea
                  value={rule.text}
                  onChange={e => setRules(prev => ({ ...prev, [n]: { ...prev[n], text: e.target.value } }))}
                  spellCheck={false}
                  placeholder={`ON <trigger> DO <command> ENDON`}
                  className={`w-full min-h-[100px] font-mono text-xs bg-muted/50 border rounded-md px-3 py-2 resize-y
                    focus:outline-none focus:ring-2 focus:ring-ring
                    ${overLimit ? 'border-destructive' : 'border-input'}`}
                />
              )}
            </CardContent>
          </Card>
        )
      })}

      {/* ── Syntax reference ── */}
      <Card>
        <CardHeader
          className="pb-2 cursor-pointer select-none"
          onClick={() => setDocsOpen(v => !v)}
        >
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <BookOpen size={14} />
            <span>Syntax Reference</span>
            <div className="flex-1" />
            {docsOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </div>
        </CardHeader>
        {docsOpen && (
          <CardContent className="pt-0">
            <pre className="text-xs text-muted-foreground font-mono whitespace-pre-wrap leading-relaxed">
              {DOCS}
            </pre>
          </CardContent>
        )}
      </Card>
    </div>
  )
}
