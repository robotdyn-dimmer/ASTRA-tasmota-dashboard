import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SettingsState {
  // MQTT
  mqttBrokerUrl: string
  mqttUsername:  string
  mqttPassword:  string

  // Theme
  theme: 'dark' | 'light'

  // Discovery
  autoDiscovery: boolean

  // HTTP-only mode: IP of first device used to bootstrap config
  configDeviceIp: string

  // Viewer role: SHA-256 hash of the viewer PIN (empty = no PIN, admin-only access)
  viewerPinHash: string

  // Widget plugins: list of ESM module URLs
  widgetPlugins: string[]

  // Auto-sync: automatically push config changes to device
  autoSyncEnabled: boolean

  // Actions
  setMqttConfig:     (url: string, username: string, password: string) => void
  setTheme:          (theme: 'dark' | 'light') => void
  setAutoDiscovery:  (enabled: boolean) => void
  setConfigDeviceIp: (ip: string) => void
  setViewerPinHash:  (hash: string) => void
  setAutoSyncEnabled:(enabled: boolean) => void
  addWidgetPlugin:   (url: string) => void
  removeWidgetPlugin:(url: string) => void
  /** Merge shared settings from hub device config (does NOT touch local-only fields like theme, viewerPinHash) */
  mergeFromDevice:   (settings: { mqttBrokerUrl: string; mqttUsername: string; mqttPassword: string; autoDiscovery: boolean; widgetPlugins: string[]; configDeviceIp: string }) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      mqttBrokerUrl:  import.meta.env.VITE_MQTT_BROKER_URL || 'ws://localhost:9001',
      mqttUsername:   import.meta.env.VITE_MQTT_USERNAME   || '',
      mqttPassword:   import.meta.env.VITE_MQTT_PASSWORD   || '',
      theme:          'light',
      autoDiscovery:  true,
      configDeviceIp: '',
      viewerPinHash:  '',
      widgetPlugins:  [],
      autoSyncEnabled: false,

      setMqttConfig:      (url, username, password) => set({ mqttBrokerUrl: url, mqttUsername: username, mqttPassword: password }),
      setTheme:           (theme) => set({ theme }),
      setAutoDiscovery:   (enabled) => set({ autoDiscovery: enabled }),
      setConfigDeviceIp:  (ip) => set({ configDeviceIp: ip }),
      setViewerPinHash:   (hash) => set({ viewerPinHash: hash }),
      setAutoSyncEnabled: (enabled) => set({ autoSyncEnabled: enabled }),
      addWidgetPlugin:    (url) => set(s => ({ widgetPlugins: s.widgetPlugins.includes(url) ? s.widgetPlugins : [...s.widgetPlugins, url] })),
      removeWidgetPlugin: (url) => set(s => ({ widgetPlugins: s.widgetPlugins.filter(u => u !== url) })),
      mergeFromDevice:    (settings) => set({
        mqttBrokerUrl:  settings.mqttBrokerUrl,
        mqttUsername:    settings.mqttUsername,
        mqttPassword:   settings.mqttPassword,
        autoDiscovery:  settings.autoDiscovery,
        widgetPlugins:  settings.widgetPlugins,
        configDeviceIp: settings.configDeviceIp,
      }),
    }),
    { name: 'astra-settings' }
  )
)
