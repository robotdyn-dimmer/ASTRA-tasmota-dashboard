import mqtt, { type MqttClient as MqttJsClient, type IClientOptions } from 'mqtt'
import type { MqttConfig, MqttMessage, MqttSubscriptionCallback, ConnectionState } from './types'
import { MQTT_DEFAULTS } from '@/core/config/constants'

type ConnectionStateListener = (state: ConnectionState) => void

class MqttClient {
  private client: MqttJsClient | null = null
  private subscriptions = new Map<string, Set<MqttSubscriptionCallback>>()
  private stateListeners = new Set<ConnectionStateListener>()
  private _connectionState: ConnectionState = 'disconnected'

  get connectionState(): ConnectionState {
    return this._connectionState
  }

  private setConnectionState(state: ConnectionState) {
    this._connectionState = state
    this.stateListeners.forEach(listener => listener(state))
  }

  onConnectionStateChange(listener: ConnectionStateListener): () => void {
    this.stateListeners.add(listener)
    return () => { this.stateListeners.delete(listener) }
  }

  connect(config: MqttConfig): void {
    if (this.client) {
      this.disconnect()
    }

    this.setConnectionState('connecting')

    const options: IClientOptions = {
      clientId: config.clientId || `astra_${Math.random().toString(16).slice(2, 10)}`,
      keepalive: config.keepalive ?? MQTT_DEFAULTS.KEEPALIVE,
      reconnectPeriod: config.reconnectPeriod ?? MQTT_DEFAULTS.RECONNECT_PERIOD,
      connectTimeout: MQTT_DEFAULTS.CONNECT_TIMEOUT,
      clean: true,
    }

    if (config.username) {
      options.username = config.username
      options.password = config.password
    }

    this.client = mqtt.connect(config.brokerUrl, options)

    this.client.on('connect', () => {
      this.setConnectionState('connected')
      // Re-subscribe to all existing subscriptions after reconnect
      for (const topic of this.subscriptions.keys()) {
        this.client?.subscribe(topic, { qos: MQTT_DEFAULTS.QOS })
      }
    })

    this.client.on('reconnect', () => {
      this.setConnectionState('connecting')
    })

    this.client.on('close', () => {
      this.setConnectionState('disconnected')
    })

    this.client.on('error', (err) => {
      console.error('[MQTT] Connection error:', err.message)
      this.setConnectionState('error')
    })

    this.client.on('message', (topic: string, payload: Buffer, packet) => {
      const message: MqttMessage = {
        topic,
        payload: payload.toString(),
        retained: packet.retain,
        qos: packet.qos,
        timestamp: Date.now(),
      }

      // Match against all subscribed patterns
      for (const [pattern, callbacks] of this.subscriptions) {
        if (this.topicMatchesPattern(topic, pattern)) {
          callbacks.forEach(cb => cb(message))
        }
      }
    })
  }

  disconnect(): void {
    if (this.client) {
      this.client.end(true)
      this.client = null
    }
    this.setConnectionState('disconnected')
  }

  subscribe(topicPattern: string, callback: MqttSubscriptionCallback): () => void {
    if (!this.subscriptions.has(topicPattern)) {
      this.subscriptions.set(topicPattern, new Set())
      // Actually subscribe on the broker if connected
      if (this.client?.connected) {
        this.client.subscribe(topicPattern, { qos: MQTT_DEFAULTS.QOS })
      }
    }

    this.subscriptions.get(topicPattern)!.add(callback)

    // Return unsubscribe function
    return () => {
      const callbacks = this.subscriptions.get(topicPattern)
      if (callbacks) {
        callbacks.delete(callback)
        if (callbacks.size === 0) {
          this.subscriptions.delete(topicPattern)
          if (this.client?.connected) {
            this.client.unsubscribe(topicPattern)
          }
        }
      }
    }
  }

  publish(topic: string, payload: string, options?: { qos?: 0 | 1 | 2; retain?: boolean }): void {
    if (!this.client?.connected) {
      console.warn('[MQTT] Cannot publish: not connected')
      return
    }

    this.client.publish(topic, payload, {
      qos: options?.qos ?? MQTT_DEFAULTS.QOS,
      retain: options?.retain ?? false,
    })
  }

  private topicMatchesPattern(topic: string, pattern: string): boolean {
    const topicParts = topic.split('/')
    const patternParts = pattern.split('/')

    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i] === '#') return true
      if (patternParts[i] === '+') continue
      if (i >= topicParts.length || patternParts[i] !== topicParts[i]) return false
    }

    return topicParts.length === patternParts.length
  }
}

// Singleton instance
export const mqttClient = new MqttClient()
