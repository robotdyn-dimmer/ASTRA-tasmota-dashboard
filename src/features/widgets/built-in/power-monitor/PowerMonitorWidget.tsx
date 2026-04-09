import { useRef, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import type { WidgetProps } from '@/features/widgets/registry/widget-types'
import { Zap } from 'lucide-react'

interface DataPoint {
  time:    string
  power:   number
  voltage: number
  current: number
}

interface PowerConfig {
  showChart?:   boolean
  chartMetric?: 'power' | 'voltage' | 'current'
  showTotals?:  boolean
  maxPoints?:   number
}

const METRIC_COLOR: Record<string, string> = {
  power:   'var(--color-chart-1)',
  voltage: 'var(--color-chart-2)',
  current: 'var(--color-chart-3)',
}

export default function PowerMonitorWidget({ devices, deviceStates, config }: WidgetProps) {
  const dataRef = useRef<DataPoint[]>([])
  const cfg     = config.settings as PowerConfig

  const showChart  = cfg.showChart   ?? true
  const metric     = cfg.chartMetric ?? 'power'
  const showTotals = cfg.showTotals  ?? true
  const maxPts     = cfg.maxPoints   ?? 60

  const device = devices[0]
  const state  = deviceStates[0]
  const energy = state?.energy

  useEffect(() => {
    if (!energy) return
    const point: DataPoint = {
      time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      power:   energy.power,
      voltage: energy.voltage,
      current: energy.current,
    }
    dataRef.current = [...dataRef.current.slice(-(maxPts - 1)), point]
  }, [energy?.power, energy?.voltage, energy?.current, maxPts])

  if (!device || !state) {
    return <div className="text-muted-foreground text-sm p-4">No device selected</div>
  }

  return (
    <div className="h-full flex flex-col p-3">
      <div className="flex items-center gap-2 mb-2">
        <Zap size={16} className="text-yellow-500 dark:text-yellow-400" />
        <h4 className="text-sm font-medium truncate">{device.friendlyName}</h4>
      </div>

      {energy ? (
        <>
          <div className="grid grid-cols-3 gap-2 mb-3">
            <ValueBox label="Power"   value={`${energy.power}W`}   color="text-yellow-600 dark:text-yellow-400" active={metric === 'power'} />
            <ValueBox label="Voltage" value={`${energy.voltage}V`} color="text-green-600 dark:text-green-400"  active={metric === 'voltage'} />
            <ValueBox label="Current" value={`${energy.current}A`} color="text-primary"                        active={metric === 'current'} />
          </div>

          {showChart && (
            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dataRef.current}>
                  <XAxis
                    dataKey="time"
                    tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                    width={35}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--card)',
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                      fontSize: 12,
                    }}
                    labelStyle={{ color: 'var(--foreground)' }}
                    itemStyle={{ color: 'var(--muted-foreground)' }}
                  />
                  <Line
                    type="monotone"
                    dataKey={metric}
                    stroke={METRIC_COLOR[metric]}
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {showTotals && (
            <div className="flex justify-between text-xs text-muted-foreground/70 mt-1">
              <span>Today: {energy.today} kWh</span>
              <span>Total: {energy.total} kWh</span>
            </div>
          )}
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
          No energy data available
        </div>
      )}
    </div>
  )
}

function ValueBox({ label, value, color, active }: { label: string; value: string; color: string; active: boolean }) {
  return (
    <div className={`bg-muted rounded-md p-2 text-center ring-1 transition-all ${active ? 'ring-primary/40' : 'ring-transparent'}`}>
      <div className={`text-base font-bold ${color}`}>{value}</div>
      <div className="text-[10px] text-muted-foreground/70">{label}</div>
    </div>
  )
}
