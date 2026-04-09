import { useEffect, useState, useCallback } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { Zap, TrendingUp, Calendar, DollarSign } from 'lucide-react'
import type { WidgetProps } from '@/features/widgets/registry/widget-types'
import { sensorHistoryDB, downsample, TIME_RANGES, type TimeRange } from '@/core/history/sensor-history-db'

interface EnergyConfig {
  tariff?:      number   // cost per kWh (0 = don't show)
  currency?:    string
  timeRange?:   TimeRange
  showCurrent?: boolean
  showVoltage?: boolean
}

interface ChartPoint {
  timeLabel: string
  power:     number
}

const RANGE_LABELS: TimeRange[] = ['1h', '6h', '24h', '7d']

export default function EnergyDashboardWidget({ devices, deviceStates, config }: WidgetProps) {
  const device = devices[0]
  const state  = deviceStates[0]
  const energy = state?.energy

  const cfg         = config.settings as EnergyConfig
  const tariff      = cfg.tariff      ?? 0
  const currency    = cfg.currency    ?? '₽'
  const timeRange   = (cfg.timeRange  as TimeRange) ?? '6h'
  const showCurrent = cfg.showCurrent ?? true
  const showVoltage = cfg.showVoltage ?? true

  const [chartData, setChartData]   = useState<ChartPoint[]>([])
  const [activeRange, setActiveRange] = useState<TimeRange>(timeRange)

  const loadPowerHistory = useCallback(async () => {
    if (!device) return
    const fromTs = Date.now() - TIME_RANGES[activeRange]
    const readings = await sensorHistoryDB.getReadings(device.id, 'ENERGY.Power', fromTs)
    const downsampled = downsample(readings, 120)
    setChartData(downsampled.map(r => ({
      timeLabel: formatTime(r.timestamp, activeRange),
      power: r.value,
    })))
  }, [device?.id, activeRange])

  useEffect(() => { loadPowerHistory() }, [loadPowerHistory, state?.lastSeen])

  if (!device) {
    return <Empty>No device selected</Empty>
  }

  if (!energy) {
    return <Empty>No energy data — device needs power monitoring (e.g. Sonoff POW)</Empty>
  }


  return (
    <div className="h-full flex flex-col p-3 gap-2">

      {/* ── Header ── */}
      <div className="flex items-center gap-2 shrink-0">
        <Zap size={15} className="text-yellow-500 dark:text-yellow-400 shrink-0" />
        <p className="text-sm font-medium truncate flex-1">{device.friendlyName}</p>
        {!state?.online && (
          <span className="text-xs text-destructive shrink-0">Offline</span>
        )}
      </div>

      {/* ── Live metrics ── */}
      <div className="grid grid-cols-3 gap-1.5 shrink-0">
        <MetricBox
          label="Power"
          value={`${energy.power}`}
          unit="W"
          highlight
          color="text-yellow-600 dark:text-yellow-400"
        />
        {showVoltage && (
          <MetricBox
            label="Voltage"
            value={`${energy.voltage}`}
            unit="V"
            color="text-green-600 dark:text-green-400"
          />
        )}
        {showCurrent && (
          <MetricBox
            label="Current"
            value={`${energy.current}`}
            unit="A"
            color="text-primary"
          />
        )}
        {!showVoltage && !showCurrent && (
          <MetricBox label="Factor" value={`${energy.factor}`} unit="PF" />
        )}
      </div>

      {/* ── Energy totals ── */}
      <div className="grid grid-cols-3 gap-1.5 shrink-0">
        <TotalBox
          icon={<Calendar size={11} />}
          label="Today"
          kwh={energy.today}
          cost={tariff > 0 ? energy.today * tariff : null}
          currency={currency}
        />
        <TotalBox
          icon={<Calendar size={11} />}
          label="Yesterday"
          kwh={energy.yesterday}
          cost={tariff > 0 ? energy.yesterday * tariff : null}
          currency={currency}
        />
        <TotalBox
          icon={<TrendingUp size={11} />}
          label="Total"
          kwh={energy.total}
          cost={tariff > 0 ? energy.total * tariff : null}
          currency={currency}
          dimCost
        />
      </div>

      {/* ── Power history chart ── */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="flex gap-0.5">
          {RANGE_LABELS.map(r => (
            <button
              key={r}
              onClick={() => setActiveRange(r)}
              className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${
                activeRange === r
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">Power history</p>
      </div>

      <div className="flex-1 min-h-0">
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 2, right: 2, bottom: 0, left: -16 }}>
              <defs>
                <linearGradient id="powerGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="var(--color-chart-1)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--color-chart-1)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.4} />
              <XAxis
                dataKey="timeLabel"
                tick={{ fontSize: 9, fill: 'var(--muted-foreground)' }}
                interval="preserveStartEnd"
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 9, fill: 'var(--muted-foreground)' }}
                tickLine={false}
                width={28}
                unit="W"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--card)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  fontSize: 11,
                }}
                labelStyle={{ color: 'var(--foreground)' }}
                formatter={((v: number) => [`${v.toFixed(1)} W`, 'Power']) as any}
              />
              <Area
                type="monotone"
                dataKey="power"
                stroke="var(--color-chart-1)"
                strokeWidth={2}
                fill="url(#powerGrad)"
                dot={false}
                connectNulls
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
            No power history for {activeRange}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function MetricBox({ label, value, unit, color = 'text-foreground', highlight = false }: {
  label:      string
  value:      string
  unit:       string
  color?:     string
  highlight?: boolean
}) {
  return (
    <div className={`bg-muted rounded-md p-2 text-center ${highlight ? 'ring-1 ring-primary/30' : ''}`}>
      <div className={`text-sm font-bold tabular-nums ${color}`}>{value}</div>
      <div className="text-[9px] text-muted-foreground">{unit}</div>
      <div className="text-[9px] text-muted-foreground/70">{label}</div>
    </div>
  )
}

function TotalBox({ icon, label, kwh, cost, currency, dimCost = false }: {
  icon:      React.ReactNode
  label:     string
  kwh:       number
  cost:      number | null
  currency:  string
  dimCost?:  boolean
}) {
  return (
    <div className="bg-muted/60 rounded-md px-2 py-1.5 text-center">
      <div className="flex items-center justify-center gap-0.5 text-muted-foreground/70 mb-0.5">
        {icon}
        <span className="text-[9px]">{label}</span>
      </div>
      <div className="text-xs font-semibold tabular-nums">{kwh.toFixed(3)}</div>
      <div className="text-[9px] text-muted-foreground">kWh</div>
      {cost !== null && (
        <div className={`text-[9px] tabular-nums mt-0.5 flex items-center justify-center gap-0.5 ${dimCost ? 'text-muted-foreground/60' : 'text-primary/80'}`}>
          <DollarSign size={8} />
          {cost.toFixed(2)} {currency}
        </div>
      )}
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full flex items-center justify-center p-4 text-sm text-muted-foreground text-center">
      {children}
    </div>
  )
}

function formatTime(ts: number, range: TimeRange): string {
  const d = new Date(ts)
  if (range === '7d')  return d.toLocaleDateString('en', { month: 'short', day: 'numeric' })
  if (range === '24h') return d.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', hour12: false })
  return d.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
}
