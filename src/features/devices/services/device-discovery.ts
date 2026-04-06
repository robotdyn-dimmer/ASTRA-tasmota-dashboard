import { mqttClient } from '@/core/mqtt/MqttClient'
import { buildCommandTopic } from '@/lib/tasmota-topic-utils'
import { useDeviceStore } from '@/features/devices/store/device-store'

export function requestFullStatus(mqttTopic: string): void {
  mqttClient.publish(buildCommandTopic(mqttTopic, 'STATUS'), '0')
}

export function requestAllDevicesStatus(): void {
  const devices = useDeviceStore.getState().devices
  for (const device of Object.values(devices)) {
    requestFullStatus(device.mqttTopic)
  }
}
