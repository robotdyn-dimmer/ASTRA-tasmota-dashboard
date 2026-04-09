/**
 * DeviceConsoleTab — live Tasmota console embedded in ASTRA.
 *
 * Log polling:
 *   Tasmota 15.x: GET /cs?c2=<lastId>[&c1=<command>]
 *   Response format: "<newId>}1<clearFlag>}1<logText>"
 *   clearFlag=0 → clear terminal; clearFlag=1 → append
 *
 * Command execution:
 *   Inline via /cs?c2=<id>&c1=<command>  (same request as poll)
 *   OR fallback: GET /cm?cmnd=<command>
 *
 * Tasmota log prefix codes (appear in each line after timestamp):
 *   CMD → blue    RSL/MQT → green    ERR/FAIL → red    others → default
 */

import { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react'
import { Send, Trash2, Pause, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { TasmotaDevice } from '@/features/devices/store/device-store.types'

/** Route private IPs through Vite dev proxy to bypass Chrome PNA restrictions */
const IS_DEV = import.meta.env.DEV
function deviceUrl(ip: string, path: string): string {
  if (IS_DEV && /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip.split(':')[0])) {
    return `/device-proxy/${ip}${path}`
  }
  return `http://${ip}${path}`
}

const POLL_INTERVAL = 2345   // match Tasmota's default ltm value
const MAX_LOG_LINES = 500

// ── Log line colour ────────────────────────────────────────────────────────────

function lineClass(line: string): string {
  const l = line.toLowerCase()
  if (l.includes('error') || l.includes(' err:') || l.includes('fail'))
    return 'text-red-400'
  if (l.includes('warn'))
    return 'text-yellow-400'
  if (l.includes(' cmd:') || l.includes(' htp:') || l.includes(' cfg:'))
    return 'text-sky-400'
  if (l.includes(' rsl:') || l.includes(' mqt:') || l.includes(' mtt:'))
    return 'text-green-400'
  if (l.includes(' app:') || l.includes(' inf:') || l.includes(' qpc:'))
    return 'text-zinc-500'
  if (l.startsWith('>'))   return 'text-yellow-300'   // sent command echo
  if (l.startsWith('←'))   return 'text-emerald-400'  // response
  if (l.startsWith('✗'))   return 'text-red-400'
  return 'text-zinc-300'
}

// ── Quick commands ─────────────────────────────────────────────────────────────

const QUICK_CMDS = [
  { label: 'Status 0',  cmd: 'Status 0'  },
  { label: 'GPIO 255',  cmd: 'GPIO 255'  },
  { label: 'Template',  cmd: 'Template'  },
  { label: 'Module',    cmd: 'Module'    },
  { label: 'Timers',    cmd: 'Timers'    },
  { label: 'Rule1',     cmd: 'Rule1'     },
  { label: 'Restart 1', cmd: 'Restart 1' },
]

// ── Component ──────────────────────────────────────────────────────────────────

interface Props { device: TasmotaDevice }

export function DeviceConsoleTab({ device }: Props) {
  const [lines,   setLines]   = useState<string[]>(['▶ Console ready — polling device log every 2s'])
  const [input,   setInput]   = useState('')
  const [sending, setSending] = useState(false)
  const [paused,  setPaused]  = useState(false)
  const [history, setHistory] = useState<string[]>([])
  const [histIdx, setHistIdx] = useState(-1)

  const logEndRef  = useRef<HTMLDivElement>(null)
  const pollRef    = useRef<ReturnType<typeof setInterval> | null>(null)
  const logIdRef   = useRef(0)     // last known log sequence id from device
  const pendingCmd = useRef('')    // command to send on next poll tick

  // ── Auto-scroll ───────────────────────────────────────────────────────────

  useLayoutEffect(() => {
    if (!paused) logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [lines, paused])

  // ── Poll /cs?c2=<id> ─────────────────────────────────────────────────────

  const poll = useCallback(async () => {
    if (!device.ipAddress || paused) return

    try {
      // Build URL — include command if one is pending
      let url = deviceUrl(device.ipAddress, `/cs?c2=${logIdRef.current}`)
      if (pendingCmd.current) {
        url += `&c1=${encodeURIComponent(pendingCmd.current)}`
        pendingCmd.current = ''
      }

      const res = await fetch(url, {
        signal: AbortSignal.timeout(4000),
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      })
      if (!res.ok) return

      const text = await res.text()
      // Format: "<newId>}1<clearFlag>}1<logText>"
      // Tasmota uses exactly 2 occurrences of }1 as separators — split only at first 2
      const sep1 = text.indexOf('}1')
      if (sep1 === -1) return
      const sep2 = text.indexOf('}1', sep1 + 2)
      if (sep2 === -1) return

      const newId   = parseInt(text.slice(0, sep1), 10)
      const clear   = text.slice(sep1 + 2, sep2) === '0'
      const logText = text.slice(sep2 + 2).trim()

      if (!isNaN(newId)) logIdRef.current = newId

      if (!logText) return

      const newLines = logText
        .split('\n')
        .map(l => l.trim().replace(/\}1\s*$/, ''))   // strip trailing }1 terminator
        .filter(l => l.length > 0 && l !== '}1')

      setLines(prev => {
        const base = clear ? [] : prev
        return [...base, ...newLines].slice(-MAX_LOG_LINES)
      })
    } catch {
      // silent — device may be briefly unreachable
    }
  }, [device.ipAddress, paused])

  useEffect(() => {
    if (!device.ipAddress) return
    logIdRef.current = 0
    poll()
    pollRef.current = setInterval(poll, POLL_INTERVAL)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [poll, device.ipAddress])

  // ── Send command ──────────────────────────────────────────────────────────

  const sendCommand = useCallback((cmd: string) => {
    const command = cmd.trim()
    if (!command || !device.ipAddress) return

    // Echo locally
    setLines(prev => [...prev.slice(-MAX_LOG_LINES + 1), `> ${command}`])

    // History
    setHistory(prev => [command, ...prev.filter(c => c !== command)].slice(0, 50))
    setHistIdx(-1)

    // Queue for next poll tick (Tasmota's console uses same endpoint for send+receive)
    pendingCmd.current = command
    setSending(true)
    // Brief visual feedback — poll will clear it when response arrives
    setTimeout(() => setSending(false), 800)
  }, [device.ipAddress])

  // ── Input handlers ────────────────────────────────────────────────────────

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      sendCommand(input)
      setInput('')
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      const idx = Math.min(histIdx + 1, history.length - 1)
      setHistIdx(idx)
      setInput(history[idx] ?? '')
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      const idx = Math.max(histIdx - 1, -1)
      setHistIdx(idx)
      setInput(idx === -1 ? '' : (history[idx] ?? ''))
    }
  }

  // ── No IP ─────────────────────────────────────────────────────────────────

  if (!device.ipAddress) {
    return (
      <div className="text-sm text-muted-foreground text-center py-12">
        IP address required to use the console.
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-3">

      {/* ── Quick commands + controls ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex gap-1 flex-wrap flex-1">
          {QUICK_CMDS.map(q => (
            <button
              key={q.cmd}
              onClick={() => sendCommand(q.cmd)}
              disabled={sending}
              className="px-2 py-0.5 text-[11px] font-mono rounded border border-border
                         bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground
                         disabled:opacity-40 transition-colors"
            >
              {q.label}
            </button>
          ))}
        </div>
        <Button size="sm" variant="ghost" className="h-7 gap-1.5 shrink-0" onClick={() => setPaused(v => !v)}>
          {paused ? <><Play size={12} /> Resume</> : <><Pause size={12} /> Pause</>}
        </Button>
        <Button
          size="sm" variant="ghost"
          className="h-7 gap-1.5 text-muted-foreground shrink-0"
          onClick={() => { setLines([]); logIdRef.current = 0 }}
        >
          <Trash2 size={12} />
        </Button>
      </div>

      {/* ── Log output ── */}
      <div className="relative rounded-lg border border-border bg-zinc-950 overflow-hidden">
        <div className="h-[380px] overflow-y-auto p-3 font-mono text-xs leading-relaxed">
          {lines.map((line, i) => (
            <div key={i} className={lineClass(line)}>{line}</div>
          ))}
          <div ref={logEndRef} />
        </div>
        {paused && (
          <div className="absolute top-2 right-2 text-[10px] bg-yellow-500/20 text-yellow-400
                          border border-yellow-500/30 rounded px-1.5 py-0.5">
            PAUSED
          </div>
        )}
      </div>

      {/* ── Input ── */}
      <div className="flex gap-2">
        <span className="text-sm font-mono text-muted-foreground self-center shrink-0">&gt;</span>
        <Input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Tasmota command  (e.g. Power1 TOGGLE, GPIO 255, Rule1 ON ...)"
          className="font-mono text-sm h-9"
          disabled={sending}
          autoComplete="off"
          spellCheck={false}
        />
        <Button
          size="sm" className="h-9 px-3 gap-1.5 shrink-0"
          onClick={() => { sendCommand(input); setInput('') }}
          disabled={sending || !input.trim()}
        >
          <Send size={13} /> Send
        </Button>
      </div>

      <p className="text-[11px] text-muted-foreground/60">
        ↑↓ history · Enter to send · polls every 2.3s via /cs?c2= endpoint
      </p>
    </div>
  )
}
