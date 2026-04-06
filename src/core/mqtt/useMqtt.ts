import { useEffect, useRef } from 'react'
import { mqttClient } from './MqttClient'
import { useMqttContext } from './MqttProvider'
import type { MqttSubscriptionCallback } from './types'

export function useMqttSubscription(
  topicPattern: string | string[],
  callback: MqttSubscriptionCallback,
  enabled = true
): void {
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  useEffect(() => {
    if (!enabled) return

    const patterns = Array.isArray(topicPattern) ? topicPattern : [topicPattern]
    const unsubscribes = patterns.map(pattern =>
      mqttClient.subscribe(pattern, (msg) => callbackRef.current(msg))
    )

    return () => {
      unsubscribes.forEach(unsub => unsub())
    }
  }, [topicPattern, enabled])
}

export function useMqttPublish() {
  const { publish } = useMqttContext()
  return publish
}

export function useMqttConnectionState() {
  const { connectionState } = useMqttContext()
  return connectionState
}

export { useMqttContext }
