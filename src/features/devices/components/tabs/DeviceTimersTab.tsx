/**
 * DeviceTimersTab — view and edit Tasmota timers (Timer1–Timer16).
 * Embedded as a tab in DeviceDetailPage.
 *
 * Tasmota API:
 *   GET  /cm?cmnd=Timers          → all 16 timers + global enable
 *   POST /cm?cmnd=Timer1 <json>   → save single timer
 *   POST /cm?cmnd=Timers 1/0      → global enable/disable
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { Plus, Clock, Trash2, Save, RefreshCw, AlertCircle, Globe } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { tasmotaHttp, HttpError } from '@/core/http/tasmota-http-client'
import type { TasmotaDevice } from '@/features/devices/store/device-store.types'

interface TasmotaTimer {
  Enable:  0 | 1
  Mode:    0 | 1 | 2 | 3
  Time:    string
  Window:  number
  Days:    string
  Repeat:  0 | 1
  Output:  number
  Action:  0 | 1 | 2 | 3
}

const DEFAULT_TIMER: TasmotaTimer = {
  Enable: 0, Mode: 0, Time: '00:00', Window: 0,
  Days: '1111111', Repeat: 1, Output: 1, Action: 1,
}

const DAYS_LABELS  = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const MODE_LABELS  = ['Time', 'Single', 'Sunrise', 'Sunset']
const ACTION_LABELS = ['Off', 'On', 'Toggle', 'Rule']

interface Props {
  device: TasmotaDevice
}

export function DeviceTimersTab({ device }: Props) {
  const [timers, setTimers]                = useState<Record<string, TasmotaTimer>>({})
  const [timersEnabled, setTimersEnabled]  = useState(true)
  const [loading, setLoading]              = useState(false)
  const [saving, setSaving]                = useState<string | null>(null)
  const [error, setError]                  = useState<string | null>(null)
  const [editingKey, setEditingKey]        = useState<string | null>(null)
  const [draft, setDraft]                  = useState<TasmotaTimer>(DEFAULT_TIMER)
  const [deviceTime, setDeviceTime]        = useState('')
  const [timezone, setTimezone]            = useState(0)
  const timeTickRef                        = useRef<ReturnType<typeof setInterval> | null>(null)

  const ip = device.ipAddress

  const loadTimers = useCallback(async () => {
    if (!ip) return
    setLoading(true)
    setError(null)
    try {
      // Load timers + time + timezone in parallel
      const [timersResult, timeResult, tzResult] = await Promise.all([
        tasmotaHttp.sendCommand(ip, 'Timers'),
        tasmotaHttp.sendCommand(ip, 'Time'),
        tasmotaHttp.sendCommand(ip, 'Timezone'),
      ])

      if (!timersResult.ok) { setError('Failed to load timers'); return }
      const data = timersResult.data as Record<string, unknown>
      const parsed: Record<string, TasmotaTimer> = {}
      if (typeof data.Timers === 'string') {
        setTimersEnabled(data.Timers === 'ON' || data.Timers === '1')
      }
      for (let i = 1; i <= 16; i++) {
        const key = `Timer${i}`
        if (data[key] && typeof data[key] === 'object') {
          parsed[key] = data[key] as TasmotaTimer
        }
      }
      setTimers(parsed)

      // Parse device time
      if (timeResult.ok) {
        setDeviceTime(String((timeResult.data as Record<string, unknown>).Time ?? ''))
      }

      // Parse timezone: {"Timezone":"+08:00"} or {"Timezone":"8"}
      if (tzResult.ok) {
        const tzRaw = String((tzResult.data as Record<string, unknown>).Timezone ?? '0')
        const m = tzRaw.match(/([+-]?)(\d+)/)
        if (m) setTimezone(parseInt(m[1] + m[2], 10))
      }
    } catch (err) {
      setError(err instanceof HttpError ? `${err.type}: ${err.message}` : 'Connection failed')
    } finally {
      setLoading(false)
    }
  }, [ip])

  useEffect(() => { loadTimers() }, [loadTimers])

  // Tick device time locally every second (avoids polling)
  useEffect(() => {
    if (!deviceTime) return
    timeTickRef.current = setInterval(() => {
      setDeviceTime(prev => {
        if (!prev) return prev
        const d = new Date(prev.replace('T', 'T') + 'Z')
        d.setUTCSeconds(d.getUTCSeconds() + 1)
        return d.toISOString().slice(0, 19).replace('T', 'T')
      })
    }, 1000)
    return () => { if (timeTickRef.current) clearInterval(timeTickRef.current) }
  }, [deviceTime ? 'ticking' : 'stopped'])

  const handleTimezoneChange = async (tz: number) => {
    if (!ip) return
    setTimezone(tz)
    await tasmotaHttp.sendCommand(ip, `Timezone ${tz}`)
    // Reload to get corrected time
    const timeResult = await tasmotaHttp.sendCommand(ip, 'Time')
    if (timeResult.ok) {
      setDeviceTime(String((timeResult.data as Record<string, unknown>).Time ?? ''))
    }
  }

  const saveTimer = async (key: string, timer: TasmotaTimer) => {
    if (!ip) return
    setSaving(key)
    try {
      const result = await tasmotaHttp.sendCommand(ip, `${key} ${JSON.stringify(timer)}`)
      if (result.ok) {
        setTimers(prev => ({ ...prev, [key]: timer }))
        setEditingKey(null)
        // Auto-enable global timers when saving an enabled timer
        if (timer.Enable === 1 && !timersEnabled) {
          await tasmotaHttp.sendCommand(ip, 'Timers 1')
          setTimersEnabled(true)
        }
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
    saveTimer(key, { ...DEFAULT_TIMER, Enable: 0 as const })
  }

  const openEdit = (key: string) => {
    setDraft(timers[key] ?? { ...DEFAULT_TIMER })
    setEditingKey(key)
  }

  if (!ip) {
    return (
      <div className="text-center text-sm text-muted-foreground py-12">
        IP address required to manage timers.
      </div>
    )
  }

  const activeTimers = Object.entries(timers).filter(([, t]) => t.Enable === 1)
  const allTimerKeys = Array.from({ length: 16 }, (_, i) => `Timer${i + 1}`)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{activeTimers.length} active</Badge>
          <div className="flex items-center gap-2 text-sm ml-3">
            <span className="text-muted-foreground">All timers</span>
            <Switch checked={timersEnabled} onCheckedChange={toggleGlobal} />
          </div>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={loadTimers} disabled={loading}>
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Reload
        </Button>
      </div>

      {/* Device time & timezone */}
      {deviceTime && (
        <div className="flex items-center gap-4 p-3 bg-muted/30 rounded-lg flex-wrap">
          <div className="flex items-center gap-2">
            <Clock size={14} className="text-muted-foreground" />
            <span className="text-sm font-mono tabular-nums">{deviceTime.replace('T', ' ')}</span>
          </div>
          <div className="flex items-center gap-2">
            <Globe size={14} className="text-muted-foreground" />
            <select
              value={timezone}
              onChange={e => handleTimezoneChange(Number(e.target.value))}
              className="h-7 rounded-md border border-input bg-background px-2 text-xs"
            >
              {TIMEZONE_OPTIONS.map(tz => (
                <option key={tz.value} value={tz.value}>{tz.label}</option>
              ))}
            </select>
          </div>
          {timezone !== getBrowserTimezoneOffset() && (
            <button
              onClick={() => handleTimezoneChange(getBrowserTimezoneOffset())}
              className="text-xs text-primary hover:underline"
            >
              Use browser timezone (UTC{getBrowserTimezoneOffset() >= 0 ? '+' : ''}{getBrowserTimezoneOffset()})
            </button>
          )}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          <AlertCircle size={15} />
          {error}
          <Button variant="ghost" size="sm" className="ml-auto h-6" onClick={() => setError(null)}>Dismiss</Button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
          <RefreshCw size={16} className="animate-spin" /> Loading timers...
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
                <div className="flex items-center gap-3 p-3">
                  <span className="text-xs font-mono text-muted-foreground w-12 shrink-0">{key}</span>

                  {timer && isActive ? (
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
                  ) : (
                    <span className="text-xs text-muted-foreground flex-1 italic">
                      {timer ? 'Disabled' : 'Not configured'}
                    </span>
                  )}

                  <div className="flex items-center gap-1 shrink-0">
                    <Button size="sm" variant="ghost" className="h-7 px-2 gap-1 text-xs" onClick={() => openEdit(key)}>
                      {isActive ? 'Edit' : <><Plus size={12} /> Set</>}
                    </Button>
                    {isActive && (
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive hover:text-destructive" onClick={() => deleteTimer(key)} disabled={saving === key}>
                        <Trash2 size={12} />
                      </Button>
                    )}
                  </div>
                </div>

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

      <p className="text-xs text-muted-foreground/60">
        Timers run on the device — active even when this app is closed.
      </p>
    </div>
  )
}

// ── TimerForm ──────────────────────────────────────────────────────────────────

function TimerForm({ timerKey, draft, saving, onChange, onSave, onCancel }: {
  timerKey: string; draft: TasmotaTimer; saving: boolean
  onChange: (t: TasmotaTimer) => void; onSave: () => void; onCancel: () => void
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
        <div className="flex items-center gap-2 col-span-2 sm:col-span-1">
          <Switch id={`${timerKey}-enable`} checked={draft.Enable === 1} onCheckedChange={v => set({ Enable: v ? 1 : 0 })} />
          <Label htmlFor={`${timerKey}-enable`} className="text-sm">Enable</Label>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Time</Label>
          <Input type="time" value={draft.Time} onChange={e => set({ Time: e.target.value })} className="h-8 text-sm" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Mode</Label>
          <select value={draft.Mode} onChange={e => set({ Mode: Number(e.target.value) as TasmotaTimer['Mode'] })} className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm">
            {MODE_LABELS.map((label, i) => <option key={i} value={i}>{label}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Relay</Label>
          <Input type="number" min={1} max={8} value={draft.Output} onChange={e => set({ Output: Math.max(1, Math.min(8, Number(e.target.value))) })} className="h-8 text-sm" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="space-y-1">
          <Label className="text-xs">Action</Label>
          <select value={draft.Action} onChange={e => set({ Action: Number(e.target.value) as TasmotaTimer['Action'] })} className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm">
            {ACTION_LABELS.map((label, i) => <option key={i} value={i}>{label}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Window ±min</Label>
          <Input type="number" min={0} max={15} value={draft.Window} onChange={e => set({ Window: Number(e.target.value) })} className="h-8 text-sm" />
        </div>
        <div className="flex items-center gap-2 pt-5">
          <Switch id={`${timerKey}-repeat`} checked={draft.Repeat === 1} onCheckedChange={v => set({ Repeat: v ? 1 : 0 })} />
          <Label htmlFor={`${timerKey}-repeat`} className="text-sm">Repeat</Label>
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Days</Label>
        <div className="flex gap-1">
          {DAYS_LABELS.map((day, i) => (
            <button key={i} onClick={() => toggleDay(i)} className={`w-8 h-8 rounded text-xs font-medium transition-colors ${draft.Days[i] === '1' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
              {day}
            </button>
          ))}
          <button onClick={() => set({ Days: '1111111' })} className="ml-1 px-2 h-8 rounded text-xs text-muted-foreground hover:text-foreground">All</button>
          <button onClick={() => set({ Days: '0000000' })} className="px-2 h-8 rounded text-xs text-muted-foreground hover:text-foreground">None</button>
        </div>
      </div>
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

const TIMEZONE_OPTIONS = [
  { value: -12, label: 'UTC-12 (Baker Island)' },
  { value: -11, label: 'UTC-11 (Samoa)' },
  { value: -10, label: 'UTC-10 (Hawaii)' },
  { value: -9,  label: 'UTC-9 (Alaska)' },
  { value: -8,  label: 'UTC-8 (Pacific)' },
  { value: -7,  label: 'UTC-7 (Mountain)' },
  { value: -6,  label: 'UTC-6 (Central)' },
  { value: -5,  label: 'UTC-5 (Eastern)' },
  { value: -4,  label: 'UTC-4 (Atlantic)' },
  { value: -3,  label: 'UTC-3 (Buenos Aires)' },
  { value: -2,  label: 'UTC-2' },
  { value: -1,  label: 'UTC-1 (Azores)' },
  { value: 0,   label: 'UTC+0 (London)' },
  { value: 1,   label: 'UTC+1 (Berlin)' },
  { value: 2,   label: 'UTC+2 (Cairo)' },
  { value: 3,   label: 'UTC+3 (Moscow)' },
  { value: 4,   label: 'UTC+4 (Dubai)' },
  { value: 5,   label: 'UTC+5 (Karachi)' },
  { value: 6,   label: 'UTC+6 (Dhaka)' },
  { value: 7,   label: 'UTC+7 (Bangkok)' },
  { value: 8,   label: 'UTC+8 (Hong Kong)' },
  { value: 9,   label: 'UTC+9 (Tokyo)' },
  { value: 10,  label: 'UTC+10 (Sydney)' },
  { value: 11,  label: 'UTC+11 (Noumea)' },
  { value: 12,  label: 'UTC+12 (Auckland)' },
]

function getBrowserTimezoneOffset(): number {
  return Math.round(-new Date().getTimezoneOffset() / 60)
}

function DaysBadge({ days }: { days: string }) {
  if (days === '1111111') return <Badge variant="outline" className="text-[10px]">Every day</Badge>
  if (days === '0111110') return <Badge variant="outline" className="text-[10px]">Weekdays</Badge>
  if (days === '1000001') return <Badge variant="outline" className="text-[10px]">Weekends</Badge>
  const active = DAYS_LABELS.filter((_, i) => days[i] === '1')
  return <span className="text-xs text-muted-foreground">{active.join(', ')}</span>
}
