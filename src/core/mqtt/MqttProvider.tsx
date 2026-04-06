import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { mqttClient } from './MqttClient'
import type { ConnectionState, MqttConfig } from './types'

interface MqttContextValue {
  connectionState: ConnectionState
  connect: (config: MqttConfig) => void
  disconnect: () => void
  publish: (topic: string, payload: string) => void
}

const MqttContext = createContext<MqttContextValue | null>(null)

export function MqttProvider({ children }: { children: ReactNode }) {
  const [connectionState, setConnectionState] = useState<ConnectionState>(
    mqttClient.connectionState
  )

  useEffect(() => {
    const unsubscribe = mqttClient.onConnectionStateChange(setConnectionState)
    return unsubscribe
  }, [])

  const connect = useCallback((config: MqttConfig) => {
    mqttClient.connect(config)
  }, [])

  const disconnect = useCallback(() => {
    mqttClient.disconnect()
  }, [])

  const publish = useCallback((topic: string, payload: string) => {
    mqttClient.publish(topic, payload)
  }, [])

  return (
    <MqttContext.Provider value={{ connectionState, connect, disconnect, publish }}>
      {children}
    </MqttContext.Provider>
  )
}

export function useMqttContext(): MqttContextValue {
  const ctx = useContext(MqttContext)
  if (!ctx) throw new Error('useMqttContext must be used within MqttProvider')
  return ctx
}
