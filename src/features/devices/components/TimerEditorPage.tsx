/**
 * TimerEditorPage — view and edit Tasmota timers via HTTP.
 * Route: /devices/:id/timers
 *
 * Tasmota API:
 *   GET  /cm?cmnd=Timers          → all 16 timers + global enable
 *   POST /cm?cmnd=Timer1 <json>   → save single timer
 *   POST /cm?cmnd=Timers 1/0      → global enable/disable
 */

import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Clock, Trash2, Save, RefreshCw, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { useDeviceStore } from '@/features/devices/store/device-store'
import { tasmotaHttp, HttpError } from '@/core/http/tasmota-http-client'

// ── Types ────────────────────────────────────────────────────────────────────

interface TasmotaTimer {
  Enable:  0 | 1
  Mode:    0 | 1 | 2 | 3   // 0=Off, 1=Single, 2=Sunrise, 3=Sunset
  Time:    string           // "HH:MM"
  Window:  number           // ±minutes random window
  Days:    string           // "SMTWTFS" 7-char bitmask
  Repeat:  0 | 1
  Output:  number           // relay 1-8
  Action:  0 | 1 | 2 | 3   // 0=Off, 1=On, 2=Toggle, 3=Rule
}

const DEFAULT_TIMER: TasmotaTimer = {
  Enable: 0, Mode: 0, Time: '00:00', Window: 0,
  Days: '1111111', Repeat: 1, Output: 1, Action: 1,
}

const DAYS_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const MODE_LABELS  = ['Time', 'Single', 'Sunrise', 'Sunset']
const ACTION_LABELS = ['Off', 'On', 'Toggle', 'Rule']

// ── Component ────────────────────────────────────────────────────────────────

export function TimerEditorPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const device = useDeviceStore(s => id ? s.devices[id] : undefined)

  const [timers, setTimers]         = useState<Record<string, TasmotaTimer>>({})
  const [timersEnabled, setTimersEnabled] = useState(true)
  const [loading, setLoading]       = useState(false)
  const [saving, setSaving]         = useState<string | null>(null)
  const [error, setError]           = useState<string | null>(null)
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [draft, setDraft]           = useState<TasmotaTimer>(DEFAULT_TIMER)

  const ip = device?.ipAddress

  // ── Load timers ──────────────────────────────────────────────────────────

  const loadTimers = useCallback(async () => {
    if (!ip) { setError('No IP address configured for this device'); return }
    setLoading(true)
    setError(null)
    try {
      const result = await tasmotaHttp.sendCommand(ip, 'Timers')
      if (!result.ok) { setError('Failed to load timers'); return }

      const data = result.data as Record<string, unknown>
      const parsed: Record<string, TasmotaTimer> = {}

      // Parse "Timers" global enable
      if (typeof data.Timers === 'string') {
        setTimersEnabled(data.Timers === 'ON' || data.Timers === '1')
      }

      // Parse Timer1..Timer16
      for (let i = 1; i <= 16; i++) {
        const key = `Timer${i}`
        if (data[key] && typeof data[key] === 'object') {
          parsed[key] = data[key] as TasmotaTimer
        }
      }
      setTimers(parsed)
    } catch (err) {
      setError(err instanceof HttpError ? `${err.type}: ${err.message}` : 'Connection failed')
    } finally {
      setLoading(false)
    }
  }, [ip])

  useEffect(() => { loadTimers() }, [loadTimers])

  // ── Save timer ───────────────────────────────────────────────────────────

  const saveTimer = async (key: string, timer: TasmotaTimer) => {
    if (!ip) return
    setSaving(key)
    try {
      const result = await tasmotaHttp.sendCommand(ip, `${key} ${JSON.stringify(timer)}`)
      if (result.ok) {
        setTimers(prev => ({ ...prev, [key]: timer }))
        setEditingKey(null)
      } else {
        setError('Save failed')
      }
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Save failed')
    } finally {
      setSaving(null)
    }
  }

  const toggleGlobal = async (enabled: boolean) => {
    if (!ip) return
    await tasmotaHttp.sendCommand(ip, `Timers ${enabled ? '1' : '0'}`)
    setTimersEnabled(enabled)
  }

  const deleteTimer = (key: string) => {
    const cleared = { ...DEFAULT_TIMER, Enable: 0 as const }
    saveTimer(key, cleared)
  }

  const openEdit = (key: string) => {
    setDraft(timers[key] ?? { ...DEFAULT_TIMER })
    setEditingKey(key)
  }

  // ── Render ───────────────────────────────────────────────────────────────

  if (!device) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <p>Device not found</p>
        <Button variant="outline" className="mt-4 gap-2" onClick={() => navigate('/devices')}>
          <ArrowLeft size={15} /> Back
        </Button>
      </div>
    )
  }

  const activeTimers = Object.entries(timers).filter(([, t]) => t.Enable === 1)
  const allTimerKeys = Array.from({ length: 16 }, (_, i) => `Timer${i + 1}`)

  return (
    <div className="space-y-4 max-w-3xl">

      {/* ── Back + header ── */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => navigate(`/devices/${id}`)}>
          <ArrowLeft size={15} /> {device.friendlyName}
        </Button>
        <Separator orientation="vertical" className="h-5" />
        <div className="flex items-center gap-2">
          <Clock size={16} className="text-muted-foreground" />
          <h2 className="font-semibold">Timers</h2>
          <Badge variant="secondary">{activeTimers.length} active</Badge>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {/* Global enable */}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">All timers</span>
            <Switch checked={timersEnabled} onCheckedChange={toggleGlobal} />
          </div>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={loadTimers} disabled={loading}>
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Refresh
          </Button>
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          <AlertCircle size={15} />
          {error}
          <Button variant="ghost" size="sm" className="ml-auto h-6" onClick={() => setError(null)}>Dismiss</Button>
        </div>
      )}

      {/* ── No IP ── */}
      {!ip && (
        <div className="flex items-center gap-2 p-4 rounded-lg bg-muted text-sm text-muted-foreground">
          <AlertCircle size={15} />
          No IP address configured. Add device IP in Device Details → ASTRA Config.
        </div>
      )}

      {/* ── Timer list ── */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
          <RefreshCw size={16} className="animate-spin" /> Loading timers…
        </div>
      ) : (
        <div className="grid gap-2">
          {allTimerKeys.map(key => {
            const timer = timers[key]
            const isActive = timer?.Enable === 1
            const isEditing = editingKey === key

            return (
              <div
                key={key}
                className={`border rounded-lg transition-colors ${
                  isActive ? 'border-primary/30 bg-primary/5' : 'border-border bg-card'
                }`}
              >
                {/* ── Timer row ── */}
                <div className="flex items-center gap-3 p-3">
                  <span className="text-xs font-mono text-muted-foreground w-12 shrink-0">{key}</span>

                  {timer && isActive ? (
                    <>
                      {/* Active timer summary */}
                      <div className="flex items-center gap-2 flex-1 flex-wrap">
                        <Badge variant="default" className="text-xs">{timer.Time}</Badge>
                        <span className="text-xs text-muted-foreground">{MODE_LABELS[timer.Mode]}</span>
                        <DaysBadge days={timer.Days} />
                        <span className="text-xs">
                          Relay {timer.Output} → <strong>{ACTION_LABELS[timer.Action]}</strong>
                        </span>
                        {timer.Repeat === 0 && (
                          <Badge variant="outline" className="text-[10px]">once</Badge>
                        )}
                      </div>
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground flex-1 italic">
                      {timer ? 'Disabled' : 'Not configured'}
                    </span>
                  )}

                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 gap-1 text-xs"
                      onClick={() => openEdit(key)}
                    >
                      {isActive ? 'Edit' : <><Plus size={12} /> Set</>}
                    </Button>
                    {isActive && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-destructive hover:text-destructive"
                        onClick={() => deleteTimer(key)}
                        disabled={saving === key}
                      >
                        <Trash2 size={12} />
                      </Button>
                    )}
                  </div>
                </div>

                {/* ── Edit form (inline) ── */}
                {isEditing && (
                  <TimerForm
                    timerKey={key}
                    draft={draft}
                    saving={saving === key}
                    onChange={setDraft}
                    onSave={() => saveTimer(key, draft)}
                    onCancel={() => setEditingKey(null)}
                  />
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── TimerForm ────────────────────────────────────────────────────────────────

function TimerForm({ timerKey, draft, saving, onChange, onSave, onCancel }: {
  timerKey: string
  draft:    TasmotaTimer
  saving:   boolean
  onChange: (t: TasmotaTimer) => void
  onSave:   () => void
  onCancel: () => void
}) {
  const set = (patch: Partial<TasmotaTimer>) => onChange({ ...draft, ...patch })

  const toggleDay = (i: number) => {
    const days = draft.Days.split('')
    days[i] = days[i] === '1' ? '0' : '1'
    set({ Days: days.join('') })
  }

  return (
    <div className="border-t border-border p-3 bg-muted/30 space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">

        {/* Enable */}
        <div className="flex items-center gap-2 col-span-2 sm:col-span-1">
          <Switch
            id={`${timerKey}-enable`}
            checked={draft.Enable === 1}
            onCheckedChange={v => set({ Enable: v ? 1 : 0 })}
          />
          <Label htmlFor={`${timerKey}-enable`} className="text-sm">Enable</Label>
        </div>

        {/* Time */}
        <div className="space-y-1">
          <Label className="text-xs">Time</Label>
          <Input
            type="time"
            value={draft.Time}
            onChange={e => set({ Time: e.target.value })}
            className="h-8 text-sm"
          />
        </div>

        {/* Mode */}
        <div className="space-y-1">
          <Label className="text-xs">Mode</Label>
          <select
            value={draft.Mode}
            onChange={e => set({ Mode: Number(e.target.value) as TasmotaTimer['Mode'] })}
            className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm"
          >
            {MODE_LABELS.map((label, i) => (
              <option key={i} value={i}>{label}</option>
            ))}
          </select>
        </div>

        {/* Output */}
        <div className="space-y-1">
          <Label className="text-xs">Relay</Label>
          <Input
            type="number"
            min={1}
            max={8}
            value={draft.Output}
            onChange={e => set({ Output: Math.max(1, Math.min(8, Number(e.target.value))) })}
            className="h-8 text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Action */}
        <div className="space-y-1">
          <Label className="text-xs">Action</Label>
          <select
            value={draft.Action}
            onChange={e => set({ Action: Number(e.target.value) as TasmotaTimer['Action'] })}
            className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm"
          >
            {ACTION_LABELS.map((label, i) => (
              <option key={i} value={i}>{label}</option>
            ))}
          </select>
        </div>

        {/* Window */}
        <div className="space-y-1">
          <Label className="text-xs">Window ±min</Label>
          <Input
            type="number"
            min={0}
            max={15}
            value={draft.Window}
            onChange={e => set({ Window: Number(e.target.value) })}
            className="h-8 text-sm"
          />
        </div>

        {/* Repeat */}
        <div className="flex items-center gap-2 pt-5">
          <Switch
            id={`${timerKey}-repeat`}
            checked={draft.Repeat === 1}
            onCheckedChange={v => set({ Repeat: v ? 1 : 0 })}
          />
          <Label htmlFor={`${timerKey}-repeat`} className="text-sm">Repeat</Label>
        </div>
      </div>

      {/* Days */}
      <div className="space-y-1">
        <Label className="text-xs">Days</Label>
        <div className="flex gap-1">
          {DAYS_LABELS.map((day, i) => (
            <button
              key={i}
              onClick={() => toggleDay(i)}
              className={`w-8 h-8 rounded text-xs font-medium transition-colors ${
                draft.Days[i] === '1'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {day}
            </button>
          ))}
          <button
            onClick={() => set({ Days: '1111111' })}
            className="ml-1 px-2 h-8 rounded text-xs text-muted-foreground hover:text-foreground"
          >
            All
          </button>
          <button
            onClick={() => set({ Days: '0000000' })}
            className="px-2 h-8 rounded text-xs text-muted-foreground hover:text-foreground"
          >
            None
          </button>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <Button size="sm" onClick={onSave} disabled={saving} className="gap-1.5">
          {saving ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
          Save
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function DaysBadge({ days }: { days: string }) {
  const allActive = days === '1111111'
  const weekdays  = days === '0111110'
  const weekends  = days === '1000001'

  if (allActive) return <Badge variant="outline" className="text-[10px]">Every day</Badge>
  if (weekdays)  return <Badge variant="outline" className="text-[10px]">Weekdays</Badge>
  if (weekends)  return <Badge variant="outline" className="text-[10px]">Weekends</Badge>

  const active = DAYS_LABELS.filter((_, i) => days[i] === '1')
  return (
    <span className="text-xs text-muted-foreground">
      {active.join(', ')}
    </span>
  )
}
