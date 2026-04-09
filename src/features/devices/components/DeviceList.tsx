import { useNavigate } from 'react-router-dom'
import { useDeviceStore } from '@/features/devices/store/device-store'
import { DeviceCard } from './DeviceCard'
import { mqttClient } from '@/core/mqtt/MqttClient'
import { tasmotaHttp } from '@/core/http/tasmota-http-client'
import { buildCommandTopic } from '@/lib/tasmota-topic-utils'
import { parsePowerState } from '@/shared/utils/tasmota-parsers'
import { MonitorSmartphone, MapPin } from 'lucide-react'

export function DeviceList() {
  const navigate = useNavigate()
  const devices = useDeviceStore((s) => s.devices)
  const deviceStates = useDeviceStore((s) => s.deviceStates)

  const deviceList = Object.values(devices)
    .filter(d => d.id && d.mqttTopic)
    .sort((a, b) => a.friendlyName.localeCompare(b.friendlyName))

  // Group by room
  const hasRooms = deviceList.some(d => d.room)
  const groups = new Map<string, typeof deviceList>()

  if (hasRooms) {
    for (const d of deviceList) {
      const room = d.room || ''
      if (!groups.has(room)) groups.set(room, [])
      groups.get(room)!.push(d)
    }
  }

  const handleTogglePower = (deviceId: string, relay: string) => {
    const device = devices[deviceId]
    if (!device) return

    if (device.ipAddress) {
      tasmotaHttp.sendCommand(device.ipAddress, `${relay} TOGGLE`)
        .then(result => {
          if (result.ok) {
            const store = useDeviceStore.getState()
            const newPower = parsePowerState(result.data)
            if (Object.keys(newPower).length > 0) {
              const existing = store.deviceStates[deviceId]?.power ?? {}
              store.updateDeviceState(deviceId, {
                online: true, lastSeen: Date.now(),
                power: { ...existing, ...newPower },
              })
            }
          }
        })
        .catch(console.error)
      if (mqttClient.connectionState === 'connected') {
        mqttClient.publish(buildCommandTopic(device.mqttTopic, relay), 'TOGGLE')
      }
    } else if (mqttClient.connectionState === 'connected') {
      mqttClient.publish(buildCommandTopic(device.mqttTopic, relay), 'TOGGLE')
    }
  }

  if (deviceList.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <MonitorSmartphone size={48} className="mb-4 opacity-30" />
        <p className="text-lg font-medium">No devices yet</p>
        <p className="text-sm mt-1">Add a device manually or enable MQTT auto-discovery</p>
      </div>
    )
  }

  return hasRooms ? (
    <div className="space-y-6">
      {[...groups.entries()]
        .sort(([a], [b]) => (a || 'zzz').localeCompare(b || 'zzz'))
        .map(([room, devs]) => (
          <div key={room || '_ungrouped'}>
            <h2 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
              <MapPin size={14} />
              {room || 'Other'}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {devs.map((device) => (
                <DeviceCard
                  key={device.id}
                  device={device}
                  state={deviceStates[device.id] ?? { online: false, lastSeen: 0, power: {}, sensors: {} }}
                  onTogglePower={(relay) => handleTogglePower(device.id, relay)}

                  onClick={() => navigate(`/devices/${device.id}`)}
                />
              ))}
            </div>
          </div>
        ))}
    </div>
  ) : (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {deviceList.map((device) => (
        <DeviceCard
          key={device.id}
          device={device}
          state={deviceStates[device.id] ?? { online: false, lastSeen: 0, power: {}, sensors: {} }}
          onTogglePower={(relay) => handleTogglePower(device.id, relay)}
          onClick={() => navigate(`/devices/${device.id}`)}
        />
      ))}
    </div>
  )
}
