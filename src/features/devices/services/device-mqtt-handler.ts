import { mqttClient } from '@/core/mqtt/MqttClient'
import { MessageBuffer } from '@/core/mqtt/message-buffer'
import { parseTopic } from '@/lib/tasmota-topic-utils'
import { useDeviceStore } from '@/features/devices/store/device-store'
import { parseStatus0 } from '@/shared/utils/tasmota-parsers'
import { buildWildcardSubscriptions, buildCommandTopic } from '@/lib/tasmota-topic-utils'
import type { MqttMessage } from '@/core/mqtt/types'

let unsubscribes: Array<() => void> = []
let messageBuffer: MessageBuffer | null = null

function processMessage(message: MqttMessage): void {
  const parsed = parseTopic(message.topic)
  if (!parsed) return

  const { prefix, deviceTopic, suffix } = parsed
  const store = useDeviceStore.getState()

  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(message.payload)
  } catch {
    // LWT messages are plain strings like "Online" / "Offline"
    if (suffix === 'LWT') {
      const online = message.payload === 'Online'
      const existingDevice = store.getDeviceByTopic(deviceTopic)

      if (existingDevice) {
        store.setOnlineStatus(deviceTopic, online)
      } else if (online) {
        // Auto-discovery: create provisional device
        store.addDevice({
          mqttTopic: deviceTopic,
          friendlyName: deviceTopic,
          addedVia: 'mqtt-discovery',
        })
        store.setOnlineStatus(deviceTopic, true)
        // Request full status
        mqttClient.publish(buildCommandTopic(deviceTopic, 'STATUS'), '0')
      }
      return
    }
    return
  }

  // Route by topic prefix and suffix
  if (prefix === 'tele') {
    if (suffix === 'SENSOR') {
      store.handleTelemetry(deviceTopic, payload)
    } else if (suffix === 'STATE') {
      store.handleTelemetry(deviceTopic, payload)
    }
  } else if (prefix === 'stat') {
    if (suffix === 'RESULT') {
      store.handleStatResult(deviceTopic, payload)
    } else if (suffix === 'STATUS0') {
      // Full status response — update device info + state
      const parsed = parseStatus0(payload)
      const device = store.getDeviceByTopic(deviceTopic)
      if (device) {
        const { friendlyName, ipAddress, macAddress, firmwareVersion, hardware, module, ...stateUpdates } = parsed
        if (friendlyName || ipAddress || firmwareVersion) {
          store.updateDevice(device.id, {
            ...(friendlyName && { friendlyName }),
            ...(ipAddress && { ipAddress }),
            ...(macAddress && { macAddress }),
            ...(firmwareVersion && { firmwareVersion }),
            ...(hardware && { hardware }),
            ...(module && { module }),
          })
        }
        store.updateDeviceState(device.id, {
          online: true,
          lastSeen: Date.now(),
          ...stateUpdates,
        })
      }
    }
  }
}

function processBufferedMessages(messages: MqttMessage[]): void {
  messages.forEach(processMessage)
}

export function startDeviceMqttHandler(): void {
  stopDeviceMqttHandler()

  messageBuffer = new MessageBuffer(processBufferedMessages)

  const topics = buildWildcardSubscriptions()
  unsubscribes = topics.map(topic =>
    mqttClient.subscribe(topic, (msg) => {
      // LWT messages are processed immediately (not buffered)
      const parsed = parseTopic(msg.topic)
      if (parsed?.suffix === 'LWT') {
        processMessage(msg)
      } else {
        messageBuffer?.push(msg)
      }
    })
  )
}

export function stopDeviceMqttHandler(): void {
  unsubscribes.forEach(unsub => unsub())
  unsubscribes = []
  messageBuffer?.destroy()
  messageBuffer = null
}
