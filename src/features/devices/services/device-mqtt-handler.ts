import { mqttClient } from '@/core/mqtt/MqttClient'
import { MessageBuffer } from '@/core/mqtt/message-buffer'
import { parseTopic } from '@/lib/tasmota-topic-utils'
import { useDeviceStore } from '@/features/devices/store/device-store'
import { parseStatus0 } from '@/shared/utils/tasmota-parsers'
import { buildWildcardSubscriptions, buildCommandTopic } from '@/lib/tasmota-topic-utils'
import { ruleEngine } from '@/features/rules/engine/rule-engine'
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
    // LWT messages are plain strings: "Online" / "Offline"
    if (suffix === 'LWT') {
      const online = message.payload === 'Online'
      const existingDevice = store.getDeviceByTopic(deviceTopic)

      if (existingDevice) {
        store.setOnlineStatus(deviceTopic, online)
      } else if (online) {
        // Auto-discovery: create provisional device, then request full status
        store.addDevice({
          mqttTopic:    deviceTopic,
          friendlyName: deviceTopic,   // will be overwritten by INFO1 / STATUS response
          addedVia:     'mqtt-discovery',
        })
        store.setOnlineStatus(deviceTopic, true)
        // Ask device for full status — response arrives on stat/<topic>/STATUS0
        mqttClient.publish(buildCommandTopic(deviceTopic, 'STATUS'), '0')
      }
      return
    }
    return
  }

  // ── Route by prefix / suffix ──────────────────────────────────────────────

  if (prefix === 'tele') {

    if (suffix === 'SENSOR' || suffix === 'STATE') {
      const device    = store.getDeviceByTopic(deviceTopic)
      const prevState = device ? store.deviceStates[device.id] : undefined
      store.handleTelemetry(deviceTopic, payload)
      if (device) {
        const newState = store.deviceStates[device.id]
        if (newState) ruleEngine.onDeviceUpdate(device.id, newState, prevState)
      }

    } else if (suffix === 'INFO1') {
      // Published on startup — contains FriendlyName (and module/version)
      // {"Info1":{"Module":"Generic","Version":"13.4.0","FriendlyName":["Kitchen Light"],...}}
      const device = store.getDeviceByTopic(deviceTopic)
      if (device) {
        const info = (payload.Info1 ?? payload) as Record<string, unknown>
        const raw  = info.FriendlyName
        const friendlyName = Array.isArray(raw)
          ? (raw[0] as string)
          : (typeof raw === 'string' ? raw : undefined)
        if (friendlyName && friendlyName !== device.friendlyName) {
          store.updateDevice(device.id, { friendlyName })
        }
      }

    } else if (suffix === 'INFO2') {
      // Published on startup — contains Hostname + IPAddress
      // {"Info2":{"WebServerMode":"Admin","Hostname":"tasmota-XXXX","IPAddress":"192.168.1.100"}}
      const device = store.getDeviceByTopic(deviceTopic)
      if (device) {
        const info      = (payload.Info2 ?? payload) as Record<string, unknown>
        const ipAddress = typeof info.IPAddress === 'string' ? info.IPAddress : undefined
        if (ipAddress && ipAddress !== device.ipAddress) {
          store.updateDevice(device.id, { ipAddress })
        }
      }
    }

  } else if (prefix === 'stat') {

    if (suffix === 'RESULT') {
      // Immediate command response — relay toggle result, etc.
      store.handleStatResult(deviceTopic, payload)

    } else if (suffix === 'STATUS') {
      // Response to STATUS (section 1 only) — contains FriendlyName
      // {"Status":{"Module":0,"FriendlyName":["Kitchen Light"],"Topic":"tasmota_ABC",...}}
      const device = store.getDeviceByTopic(deviceTopic)
      if (device) {
        const status = (payload.Status ?? payload) as Record<string, unknown>
        const raw    = status.FriendlyName
        const friendlyName = Array.isArray(raw)
          ? (raw[0] as string)
          : (typeof raw === 'string' ? raw : undefined)
        if (friendlyName && friendlyName !== device.friendlyName) {
          store.updateDevice(device.id, { friendlyName })
        }
      }

    } else if (suffix === 'STATUS0') {
      // Full status response (all sections combined) — from STATUS 0 command
      const parsedStatus = parseStatus0(payload)
      const device = store.getDeviceByTopic(deviceTopic)
      if (device) {
        const {
          friendlyName, ipAddress, macAddress,
          firmwareVersion, hardware, module: mod,
          ...stateUpdates
        } = parsedStatus
        if (friendlyName || ipAddress || firmwareVersion) {
          store.updateDevice(device.id, {
            ...(friendlyName    && { friendlyName }),
            ...(ipAddress       && { ipAddress }),
            ...(macAddress      && { macAddress }),
            ...(firmwareVersion && { firmwareVersion }),
            ...(hardware        && { hardware }),
            ...(mod             && { module: mod }),
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
      // LWT processed immediately (online/offline is time-critical)
      const p = parseTopic(msg.topic)
      if (p?.suffix === 'LWT') {
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
