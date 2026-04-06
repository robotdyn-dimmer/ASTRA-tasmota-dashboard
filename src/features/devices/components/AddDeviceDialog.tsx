import { useState } from 'react'
import { X, Plus } from 'lucide-react'
import { useDeviceStore } from '@/features/devices/store/device-store'
import { requestFullStatus } from '@/features/devices/services/device-discovery'

interface AddDeviceDialogProps {
  open: boolean
  onClose: () => void
}

export function AddDeviceDialog({ open, onClose }: AddDeviceDialogProps) {
  const [mqttTopic, setMqttTopic] = useState('')
  const [friendlyName, setFriendlyName] = useState('')
  const [ipAddress, setIpAddress] = useState('')
  const addDevice = useDeviceStore((s) => s.addDevice)

  if (!open) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!mqttTopic.trim()) return

    addDevice({
      mqttTopic: mqttTopic.trim(),
      friendlyName: friendlyName.trim() || mqttTopic.trim(),
      ipAddress: ipAddress.trim() || undefined,
      addedVia: 'manual',
    })

    // Request full status from device
    requestFullStatus(mqttTopic.trim())

    setMqttTopic('')
    setFriendlyName('')
    setIpAddress('')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-surface border border-border rounded-xl p-6 w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-text">Add Device</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-surface-hover text-text-muted">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-muted mb-1">
              MQTT Topic *
            </label>
            <input
              type="text"
              value={mqttTopic}
              onChange={(e) => setMqttTopic(e.target.value)}
              placeholder="e.g., tasmota_ABC123"
              className="w-full px-3 py-2 bg-input border border-input-border rounded-md text-text text-sm focus:outline-none focus:border-input-focus transition-colors"
              required
            />
            <p className="text-xs text-text-dim mt-1">
              The MQTT topic of your Tasmota device (without prefix)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-muted mb-1">
              Friendly Name
            </label>
            <input
              type="text"
              value={friendlyName}
              onChange={(e) => setFriendlyName(e.target.value)}
              placeholder="e.g., Kitchen Light"
              className="w-full px-3 py-2 bg-input border border-input-border rounded-md text-text text-sm focus:outline-none focus:border-input-focus transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-muted mb-1">
              IP Address (optional)
            </label>
            <input
              type="text"
              value={ipAddress}
              onChange={(e) => setIpAddress(e.target.value)}
              placeholder="e.g., 192.168.1.100"
              className="w-full px-3 py-2 bg-input border border-input-border rounded-md text-text text-sm focus:outline-none focus:border-input-focus transition-colors"
            />
            <p className="text-xs text-text-dim mt-1">
              For direct HTTP access (configuration, OTA)
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-surface-hover text-text-muted rounded-md text-sm font-medium hover:bg-border transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-md text-sm font-medium transition-colors"
            >
              <Plus size={16} />
              Add Device
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
