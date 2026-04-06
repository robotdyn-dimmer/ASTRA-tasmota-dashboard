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
    `${MQTT_TOPIC_PREFIXES.TELEMETRY}/+/LWT`,
    `${MQTT_TOPIC_PREFIXES.STATUS}/+/RESULT`,
    `${MQTT_TOPIC_PREFIXES.TELEMETRY}/+/SENSOR`,
    `${MQTT_TOPIC_PREFIXES.TELEMETRY}/+/STATE`,
    `${MQTT_TOPIC_PREFIXES.STATUS}/+/STATUS0`,
  ]
}

export function deviceIdFromTopic(mqttTopic: string): string {
  return `device_${mqttTopic.replace(/[^a-zA-Z0-9_-]/g, '_')}`
}
