import { useEffect, useState, useCallback } from 'react'
import {
  ComposedChart, Line, Area, XAxis, YAxis,
  Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts'
import { RefreshCw } from 'lucide-react'
import type { WidgetProps } from '@/features/widgets/registry/widget-types'
import { sensorHistoryDB, downsample, TIME_RANGES, type TimeRange, type SensorReading } from '@/core/history/sensor-history-db'

const COLORS = [
  'var(--color-chart-1)',
  'var(--color-chart-2)',
  'var(--color-chart-3)',
  'var(--color-chart-4)',
  'var(--color-chart-5)',
]

const TIME_RANGE_LABELS: Record<TimeRange, string> = {
  '1h': '1h', '6h': '6h', '24h': '24h', '7d': '7d',
}

interface ChartPoint {
  timestamp: number
  timeLabel: string
  [sensorKey: string]: number | string
}

export default function HistoryGraphWidget({ devices, deviceStates, config }: WidgetProps) {
  const device = devices[0]
  const state  = deviceStates[0]

  const sensorKeys  = (config.settings.sensorKeys as string[] | undefined) ?? []
  const timeRange   = (config.settings.timeRange  as TimeRange | undefined) ?? '6h'
  const chartType   = (config.settings.chartType  as 'line' | 'area' | undefined) ?? 'line'

  const [data,    setData]    = useState<ChartPoint[]>([])
  const [loading, setLoading] = useState(false)

  const loadHistory = useCallback(async () => {
    if (!device || sensorKeys.length === 0) return
    setLoading(true)

    try {
      const fromTs = Date.now() - TIME_RANGES[timeRange]
      // Fetch all sensor keys in parallel
      const allReadings = await Promise.all(
        sensorKeys.map(key => sensorHistoryDB.getReadings(device.id, key, fromTs))
      )

      // Merge into unified timeline
      // Collect all unique timestamps
      const tsSet = new Set<number>()
      allReadings.forEach(readings => readings.forEach(r => tsSet.add(r.timestamp)))
      const sortedTs = Array.from(tsSet).sort((a, b) => a - b)

      // Build index: sensorKey → Map<timestamp, value>
      const indices: Map<string, Map<number, number>> = new Map()
      sensorKeys.forEach((key, i) => {
        const map = new Map<number, number>()
        allReadings[i].forEach(r => map.set(r.timestamp, r.value))
        indices.set(key, map)
      })

      // Build chart points
      const points: ChartPoint[] = sortedTs.map(ts => {
        const point: ChartPoint = { timestamp: ts, timeLabel: formatTime(ts, timeRange) }
        sensorKeys.forEach(key => {
          const val = indices.get(key)?.get(ts)
          if (val !== undefined) point[key] = val
        })
        return point
      })

      setData(downsample(points as unknown as SensorReading[], 200) as unknown as ChartPoint[])
    } finally {
      setLoading(false)
    }
  }, [device?.id, sensorKeys.join(','), timeRange])

  // Load on mount + auto-refresh every 15 seconds
  useEffect(() => {
    loadHistory()
    const interval = setInterval(loadHistory, 15_000)
    return () => clearInterval(interval)
  }, [loadHistory])

  // ── Empty / no-config states ──────────────────────────────────────────────

  if (!device) {
    return <EmptyState>No device selected</EmptyState>
  }

  if (sensorKeys.length === 0) {
    return <EmptyState>Configure sensor keys in widget settings ⚙️</EmptyState>
  }

  if (data.length === 0 && !loading) {
    return (
      <EmptyState>
        No history yet. Data accumulates as the device sends telemetry.
      </EmptyState>
    )
  }

  // ── Chart ─────────────────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col p-3 gap-2">
      {/* Header row */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="flex items-center gap-1">
          {(Object.keys(TIME_RANGE_LABELS) as TimeRange[]).map(range => (
            <span
              key={range}
              className={`text-xs px-1.5 py-0.5 rounded cursor-pointer select-none transition-colors ${
                timeRange === range
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title={`Show last ${range}`}
            >
              {range}
            </span>
          ))}
        </div>
        {loading && <RefreshCw size={12} className="animate-spin text-muted-foreground" />}
        <p className="text-sm font-medium truncate">{device.friendlyName}</p>
      </div>

      {/* Recharts */}
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
            <XAxis
              dataKey="timeLabel"
              tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
              interval="preserveStartEnd"
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
              tickLine={false}
              width={32}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--card)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                fontSize: 12,
              }}
              labelStyle={{ color: 'var(--foreground)', marginBottom: 4 }}
              itemStyle={{ color: 'var(--muted-foreground)' }}
              formatter={((value: number, name: string) => [
                value.toFixed(2),
                name.split('.').pop() ?? name,
              ]) as any}
            />
            {sensorKeys.length > 1 && (
              <Legend
                formatter={(value) => value.split('.').pop() ?? value}
                wrapperStyle={{ fontSize: 11 }}
              />
            )}
            {sensorKeys.map((key, i) => {
              const color = COLORS[i % COLORS.length]
              return chartType === 'area' ? (
                <Area
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={color}
                  fill={color}
                  fillOpacity={0.15}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
              ) : (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={color}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
              )
            })}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full flex items-center justify-center p-4 text-sm text-muted-foreground text-center">
      {children}
    </div>
  )
}

function formatTime(ts: number, range: TimeRange): string {
  const d = new Date(ts)
  if (range === '7d') return d.toLocaleDateString('en', { month: 'short', day: 'numeric' })
  if (range === '24h') return d.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', hour12: false })
  return d.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
}
