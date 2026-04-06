import type { MqttMessage } from './types'
import { MQTT_DEFAULTS } from '@/core/config/constants'

type BufferFlushCallback = (messages: MqttMessage[]) => void

export class MessageBuffer {
  private buffer: MqttMessage[] = []
  private flushInterval: ReturnType<typeof setInterval> | null = null
  private callback: BufferFlushCallback

  constructor(callback: BufferFlushCallback, intervalMs = MQTT_DEFAULTS.MESSAGE_BUFFER_INTERVAL) {
    this.callback = callback
    this.flushInterval = setInterval(() => this.flush(), intervalMs)
  }

  push(message: MqttMessage): void {
    this.buffer.push(message)
  }

  private flush(): void {
    if (this.buffer.length === 0) return

    const messages = this.buffer
    this.buffer = []
    this.callback(messages)
  }

  destroy(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval)
      this.flushInterval = null
    }
    this.flush() // Flush remaining messages
  }
}
