import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SettingsState {
  // MQTT
  mqttBrokerUrl: string
  mqttUsername: string
  mqttPassword: string

  // Theme
  theme: 'dark' | 'light'

  // Discovery
  autoDiscovery: boolean

  // Actions
  setMqttConfig: (url: string, username: string, password: string) => void
  setTheme: (theme: 'dark' | 'light') => void
  setAutoDiscovery: (enabled: boolean) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      mqttBrokerUrl: import.meta.env.VITE_MQTT_BROKER_URL || 'ws://localhost:9001',
      mqttUsername: import.meta.env.VITE_MQTT_USERNAME || '',
      mqttPassword: import.meta.env.VITE_MQTT_PASSWORD || '',
      theme: 'dark',
      autoDiscovery: true,

      setMqttConfig: (url, username, password) =>
        set({ mqttBrokerUrl: url, mqttUsername: username, mqttPassword: password }),

      setTheme: (theme) => set({ theme }),

      setAutoDiscovery: (enabled) => set({ autoDiscovery: enabled }),
    }),
    {
      name: 'astra-settings',
    }
  )
)
