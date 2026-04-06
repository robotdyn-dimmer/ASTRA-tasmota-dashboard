import { useDeviceStore } from '@/features/devices/store/device-store'
import { DeviceCard } from './DeviceCard'
import { mqttClient } from '@/core/mqtt/MqttClient'
import { buildCommandTopic } from '@/lib/tasmota-topic-utils'
import { MonitorSmartphone } from 'lucide-react'

interface DeviceListProps {
  onDeviceClick?: (deviceId: string) => void
}

export function DeviceList({ onDeviceClick }: DeviceListProps) {
  const devices = useDeviceStore((s) => s.devices)
  const deviceStates = useDeviceStore((s) => s.deviceStates)

  const deviceList = Object.values(devices).sort((a, b) => {
    const aOnline = deviceStates[a.id]?.online ? 1 : 0
    const bOnline = deviceStates[b.id]?.online ? 1 : 0
    if (aOnline !== bOnline) return bOnline - aOnline
    return a.friendlyName.localeCompare(b.friendlyName)
  })

  const handleTogglePower = (deviceId: string, relay: string) => {
    const device = devices[deviceId]
    if (!device) return
    mqttClient.publish(buildCommandTopic(device.mqttTopic, relay), 'TOGGLE')
  }

  if (deviceList.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-text-muted">
        <MonitorSmartphone size={48} className="mb-4 opacity-30" />
        <p className="text-lg font-medium">No devices yet</p>
        <p className="text-sm mt-1">Add a device manually or enable MQTT auto-discovery</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {deviceList.map((device) => (
        <DeviceCard
          key={device.id}
          device={device}
          state={deviceStates[device.id] ?? { online: false, lastSeen: 0, power: {}, sensors: {} }}
          onTogglePower={(relay) => handleTogglePower(device.id, relay)}
          onClick={onDeviceClick ? () => onDeviceClick(device.id) : undefined}
        />
      ))}
    </div>
  )
}
