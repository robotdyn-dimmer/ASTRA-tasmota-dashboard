import { MQTT_TOPIC_PREFIXES } from '@/core/config/constants'

export type TopicPrefix = 'cmnd' | 'stat' | 'tele'

export interface ParsedTopic {
  prefix: TopicPrefix
  deviceTopic: string
  suffix: string
}

export function parseTopic(fullTopic: string): ParsedTopic | null {
  const parts = fullTopic.split('/')
  if (parts.length < 3) return null

  const prefix = parts[0] as TopicPrefix
  if (!['cmnd', 'stat', 'tele'].includes(prefix)) return null

  const suffix = parts[parts.length - 1]
  const deviceTopic = parts.slice(1, -1).join('/')

  return { prefix, deviceTopic, suffix }
}

export function buildCommandTopic(deviceTopic: string, command: string): string {
  return `${MQTT_TOPIC_PREFIXES.COMMAND}/${deviceTopic}/${command}`
}

export function buildSubscriptionTopics(deviceTopic: string): string[] {
  return [
    `${MQTT_TOPIC_PREFIXES.STATUS}/${deviceTopic}/+`,
    `${MQTT_TOPIC_PREFIXES.TELEMETRY}/${deviceTopic}/+`,
  ]
}

export function buildWildcardSubscriptions(): string[] {
  return [
    // Online/offline detection — processed immediately (not buffered)
    `${MQTT_TOPIC_PREFIXES.TELEMETRY}/+/LWT`,
    // Command responses — relay state after toggle/on/off
    `${MQTT_TOPIC_PREFIXES.STATUS}/+/RESULT`,
    // Telemetry — periodic sensor + power readings
    `${MQTT_TOPIC_PREFIXES.TELEMETRY}/+/SENSOR`,
    `${MQTT_TOPIC_PREFIXES.TELEMETRY}/+/STATE`,
    // Status response — full status from STATUS 0 command (MQTT format)
    `${MQTT_TOPIC_PREFIXES.STATUS}/+/STATUS`,    // Status section only
    `${MQTT_TOPIC_PREFIXES.STATUS}/+/STATUS0`,   // All sections combined
    // Device info on startup/restart — friendlyName + IP address
    `${MQTT_TOPIC_PREFIXES.TELEMETRY}/+/INFO1`,
    `${MQTT_TOPIC_PREFIXES.TELEMETRY}/+/INFO2`,
  ]
}

export function deviceIdFromTopic(mqttTopic: string): string {
  return `device_${mqttTopic.replace(/[^a-zA-Z0-9_-]/g, '_')}`
}
