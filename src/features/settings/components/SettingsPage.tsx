import { useState } from 'react'
import { Save, TestTube } from 'lucide-react'
import { useSettingsStore } from '@/features/settings/store/settings-store'
import { useMqttContext } from '@/core/mqtt/MqttProvider'

export function SettingsPage() {
  const { mqttBrokerUrl, mqttUsername, mqttPassword, autoDiscovery, setMqttConfig, setAutoDiscovery } = useSettingsStore()
  const { connect, connectionState } = useMqttContext()

  const [url, setUrl] = useState(mqttBrokerUrl)
  const [user, setUser] = useState(mqttUsername)
  const [pass, setPass] = useState(mqttPassword)

  const handleSave = () => {
    setMqttConfig(url, user, pass)
    connect({ brokerUrl: url, username: user || undefined, password: pass || undefined })
  }

  const handleTest = () => {
    connect({ brokerUrl: url, username: user || undefined, password: pass || undefined })
  }

  return (
    <div className="max-w-2xl">
      <h2 className="text-lg font-semibold text-text mb-6">Settings</h2>

      {/* MQTT Settings */}
      <section className="bg-card border border-border rounded-lg p-5 mb-6">
        <h3 className="text-sm font-semibold text-text mb-4">MQTT Broker</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-text-muted mb-1">Broker URL</label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="ws://localhost:9001"
              className="w-full px-3 py-2 bg-input border border-input-border rounded-md text-text text-sm focus:outline-none focus:border-input-focus"
            />
            <p className="text-xs text-text-dim mt-1">WebSocket URL (ws:// or wss://)</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-text-muted mb-1">Username</label>
              <input
                type="text"
                value={user}
                onChange={(e) => setUser(e.target.value)}
                placeholder="Optional"
                className="w-full px-3 py-2 bg-input border border-input-border rounded-md text-text text-sm focus:outline-none focus:border-input-focus"
              />
            </div>
            <div>
              <label className="block text-sm text-text-muted mb-1">Password</label>
              <input
                type="password"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                placeholder="Optional"
                className="w-full px-3 py-2 bg-input border border-input-border rounded-md text-text text-sm focus:outline-none focus:border-input-focus"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-text-muted">Status:</span>
            <span className={`text-sm font-medium ${connectionState === 'connected' ? 'text-success' : connectionState === 'connecting' ? 'text-warning' : 'text-danger'}`}>
              {connectionState}
            </span>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleTest}
              className="flex items-center gap-1.5 px-4 py-2 bg-surface-hover text-text-muted rounded-md text-sm hover:bg-border transition-colors"
            >
              <TestTube size={16} />
              Test Connection
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-md text-sm font-medium transition-colors"
            >
              <Save size={16} />
              Save & Connect
            </button>
          </div>
        </div>
      </section>

      {/* Discovery Settings */}
      <section className="bg-card border border-border rounded-lg p-5">
        <h3 className="text-sm font-semibold text-text mb-4">Device Discovery</h3>
        <label className="flex items-center gap-3 cursor-pointer">
          <div
            className={`w-10 h-5 rounded-full transition-colors relative ${autoDiscovery ? 'bg-primary' : 'bg-border'}`}
            onClick={() => setAutoDiscovery(!autoDiscovery)}
          >
            <div
              className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${autoDiscovery ? 'translate-x-5' : 'translate-x-0.5'}`}
            />
          </div>
          <div>
            <span className="text-sm text-text">Auto-discover devices</span>
            <p className="text-xs text-text-dim">Automatically detect new Tasmota devices via MQTT LWT</p>
          </div>
        </label>
      </section>
    </div>
  )
}
