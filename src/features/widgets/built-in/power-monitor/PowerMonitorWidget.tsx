import { useRef, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import type { WidgetProps } from '@/features/widgets/registry/widget-types'
import { Zap } from 'lucide-react'

interface DataPoint {
  time: string
  power: number
  voltage: number
  current: number
}

const MAX_POINTS = 60

export default function PowerMonitorWidget({ devices, deviceStates }: WidgetProps) {
  const dataRef = useRef<DataPoint[]>([])

  const device = devices[0]
  const state = deviceStates[0]
  const energy = state?.energy

  useEffect(() => {
    if (!energy) return

    const point: DataPoint = {
      time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      power: energy.power,
      voltage: energy.voltage,
      current: energy.current,
    }

    dataRef.current = [...dataRef.current.slice(-(MAX_POINTS - 1)), point]
  }, [energy?.power, energy?.voltage, energy?.current])

  if (!device || !state) {
    return <div className="text-text-muted text-sm p-4">No device selected</div>
  }

  return (
    <div className="h-full flex flex-col p-3">
      <div className="flex items-center gap-2 mb-2">
        <Zap size={16} className="text-warning" />
        <h4 className="text-sm font-medium text-text truncate">{device.friendlyName}</h4>
      </div>

      {energy ? (
        <>
          <div className="grid grid-cols-3 gap-2 mb-3">
            <ValueBox label="Power" value={`${energy.power}W`} color="text-warning" />
            <ValueBox label="Voltage" value={`${energy.voltage}V`} color="text-success" />
            <ValueBox label="Current" value={`${energy.current}A`} color="text-primary" />
          </div>

          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dataRef.current}>
                <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#5a6480' }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10, fill: '#5a6480' }} width={35} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#16213e', border: '1px solid #2a3a5c', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: '#eaeaea' }}
                />
                <Line type="monotone" dataKey="power" stroke="#fbbf24" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="flex justify-between text-xs text-text-dim mt-1">
            <span>Today: {energy.today} kWh</span>
            <span>Total: {energy.total} kWh</span>
          </div>
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center text-text-dim text-sm">
          No energy data available
        </div>
      )}
    </div>
  )
}

function ValueBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-surface-hover rounded-md p-2 text-center">
      <div className={`text-base font-bold ${color}`}>{value}</div>
      <div className="text-[10px] text-text-dim">{label}</div>
    </div>
  )
}
