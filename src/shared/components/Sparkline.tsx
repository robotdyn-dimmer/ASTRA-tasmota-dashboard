import { useEffect, useState } from 'react'
import { sensorHistoryDB } from '@/core/history/sensor-history-db'
import type { SensorReading } from '@/core/history/sensor-history-db'

interface SparklineProps {
  deviceId: string
  sensorKey: string
  width?: number
  height?: number
  className?: string
  color?: string
}

export function Sparkline({ deviceId, sensorKey, width = 80, height = 24, className, color = 'currentColor' }: SparklineProps) {
  const [points, setPoints] = useState<SensorReading[]>([])

  useEffect(() => {
    let cancelled = false
    const load = () => {
      sensorHistoryDB.getLatest(deviceId, sensorKey, 30).then(data => {
        if (!cancelled) {
          // getLatest returns newest-first → reverse to chronological (oldest left, newest right)
          setPoints([...data].reverse())
        }
      })
    }
    load()
    const interval = setInterval(load, 30_000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [deviceId, sensorKey])

  if (points.length < 2) return null

  const values = points.map(p => p.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1

  const pathData = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width
    const y = height - ((v - min) / range) * (height - 2) - 1
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')

  return (
    <svg width={width} height={height} className={className} viewBox={`0 0 ${width} ${height}`}>
      <path d={pathData} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
