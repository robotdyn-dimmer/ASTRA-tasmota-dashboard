export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error'

export interface MqttConfig {
  brokerUrl: string
  username?: string
  password?: string
  clientId?: string
  keepalive?: number
  reconnectPeriod?: number
}

export interface MqttMessage {
  topic: string
  payload: string
  retained: boolean
  qos: 0 | 1 | 2
  timestamp: number
}

export type MqttSubscriptionCallback = (message: MqttMessage) => void
