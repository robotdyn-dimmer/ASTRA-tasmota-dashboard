import type { WidgetProps } from '@/features/widgets/registry/widget-types'

interface GaugeConfig {
  sensorKey?: string
  min?:       number
  max?:       number
  unit?:      string
  thresholds?: Array<{ value: number; color: 'green' | 'yellow' | 'red' }>
}

export default function GaugeWidget({ devices, deviceStates, config }: WidgetProps) {
  const device = devices[0]
  const state  = deviceStates[0]
  const cfg    = config.settings as GaugeConfig

  const sensorKey  = cfg.sensorKey ?? ''
  const min        = cfg.min ?? 0
  const max        = cfg.max ?? 100
  const unitLabel  = cfg.unit ?? ''
  const thresholds = cfg.thresholds ?? []

  if (!device) {
    return <div className="h-full flex items-center justify-center text-sm text-muted-foreground p-4">No device selected</div>
  }

  // Resolve value from sensor readings or energy
  let rawValue: number | undefined
  if (sensorKey) {
    const reading = state?.sensors?.[sensorKey]
    if (reading && typeof reading.value === 'number') {
      rawValue = reading.value
      if (!unitLabel && reading.unit) cfg.unit = reading.unit
    }
  }

  const label = sensorKey.split('.').pop() ?? sensorKey

  // Arc geometry
  const value   = rawValue ?? 0
  const pct     = Math.min(1, Math.max(0, (value - min) / (max - min)))
  const angle   = -135 + pct * 270   // arc from -135° to +135°
  const arcColor = resolveColor(value, thresholds)

  // SVG arc path helper
  const R = 42
  const CX = 60, CY = 60
  const startAngleDeg = -135
  const sweepDeg      = 270

  function polarToXY(angleDeg: number) {
    const rad = (angleDeg * Math.PI) / 180
    return { x: CX + R * Math.cos(rad), y: CY + R * Math.sin(rad) }
  }

  const bg1 = polarToXY(startAngleDeg)
  const bg2 = polarToXY(startAngleDeg + sweepDeg)


  // Track path (background)
  const bgPath = describeArc(CX, CY, R, startAngleDeg, startAngleDeg + sweepDeg)
  const fgPath = pct > 0
    ? describeArc(CX, CY, R, startAngleDeg, angle)
    : ''

  return (
    <div className="h-full flex flex-col items-center justify-center p-3 gap-1">
      <p className="text-xs font-medium text-muted-foreground truncate max-w-full">{device.friendlyName}</p>

      <div className="relative flex-1 flex items-center justify-center w-full max-w-[140px]">
        <svg viewBox="0 0 120 90" className="w-full h-full">
          {/* Track */}
          <path d={bgPath} fill="none" stroke="var(--muted)" strokeWidth="10" strokeLinecap="round" />
          {/* Fill */}
          {fgPath && (
            <path d={fgPath} fill="none" stroke={arcColor} strokeWidth="10" strokeLinecap="round" />
          )}
          {/* Value text */}
          <text x={CX} y={CY + 8} textAnchor="middle" fontSize="18" fontWeight="700" fill="var(--foreground)">
            {rawValue !== undefined ? rawValue.toFixed(1) : '—'}
          </text>
          {unitLabel && (
            <text x={CX} y={CY + 22} textAnchor="middle" fontSize="10" fill="var(--muted-foreground)">
              {unitLabel}
            </text>
          )}
          {/* Min / Max labels */}
          <text x={bg1.x - 6} y={bg1.y + 4} textAnchor="middle" fontSize="8" fill="var(--muted-foreground)">{min}</text>
          <text x={bg2.x + 6} y={bg2.y + 4} textAnchor="middle" fontSize="8" fill="var(--muted-foreground)">{max}</text>
        </svg>
      </div>

      <p className="text-xs text-muted-foreground">{label}</p>

      {!state?.online && (
        <p className="text-xs text-destructive">Offline</p>
      )}
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function describeArc(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const start = polarToCartesian(cx, cy, r, startDeg)
  const end   = polarToCartesian(cx, cy, r, endDeg)
  const sweep = ((endDeg - startDeg) + 360) % 360
  const large = sweep > 180 ? 1 : 0
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${large} 1 ${end.x} ${end.y}`
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function resolveColor(
  value: number,
  thresholds: Array<{ value: number; color: 'green' | 'yellow' | 'red' }>,
): string {
  const colorMap = { green: '#22c55e', yellow: '#f59e0b', red: '#ef4444' }
  if (!thresholds.length) return 'var(--color-chart-1)'

  const sorted = [...thresholds].sort((a, b) => b.value - a.value)
  const match  = sorted.find(t => value >= t.value)
  return match ? colorMap[match.color] : colorMap[sorted[sorted.length - 1].color]
}
