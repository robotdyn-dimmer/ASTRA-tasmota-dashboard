import { useState } from 'react'
import { Plus, Loader2, CheckCircle, AlertCircle, Search } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useDeviceStore } from '@/features/devices/store/device-store'
import { tasmotaHttp, HttpError } from '@/core/http/tasmota-http-client'
import { parseStatus0 } from '@/shared/utils/tasmota-parsers'
import { pollScheduler } from '@/core/http/poll-scheduler'

interface AddDeviceDialogProps {
  open: boolean
  onClose: () => void
}

type ValidationState = 'idle' | 'checking' | 'found' | 'error'

interface PreviewDevice {
  friendlyName: string
  firmware:     string
  hardware:     string
  ipAddress:    string
}

const IP_REGEX = /^(\d{1,3}\.){3}\d{1,3}(:\d+)?(\/.*)?$|^localhost(:\d+)?(\/.*)?$/

export function AddDeviceDialog({ open, onClose }: AddDeviceDialogProps) {
  const [ipAddress, setIpAddress] = useState('')
  const [mqttTopic, setMqttTopic] = useState('')
  const [friendlyName, setFriendlyName] = useState('')
  const [validation, setValidation] = useState<ValidationState>('idle')
  const [preview, setPreview] = useState<PreviewDevice | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  const addDevice = useDeviceStore(s => s.addDevice)

  const resetForm = () => {
    setIpAddress('')
    setMqttTopic('')
    setFriendlyName('')
    setValidation('idle')
    setPreview(null)
    setErrorMsg('')
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  const handleCheckIP = async () => {
    const ip = ipAddress.trim()
    if (!ip) return

    setValidation('checking')
    setPreview(null)
    setErrorMsg('')

    try {
      const result = await tasmotaHttp.getFullStatus(ip)
      const parsed = parseStatus0(result.data)

      const found: PreviewDevice = {
        friendlyName: parsed.friendlyName || ip,
        firmware:     parsed.firmwareVersion || 'Unknown',
        hardware:     parsed.hardware || 'Unknown',
        ipAddress:    ip,
      }
      setPreview(found)
      // Pre-fill name and topic from device if empty
      if (!friendlyName) setFriendlyName(found.friendlyName)
      if (!mqttTopic) setMqttTopic(found.friendlyName.toLowerCase().replace(/[^a-z0-9_-]/g, '_'))
      setValidation('found')
    } catch (err) {
      const msg = err instanceof HttpError
        ? getErrorHint(err)
        : 'Device not found at this IP'
      setErrorMsg(msg)
      setValidation('error')
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const topic = mqttTopic.trim() || friendlyName.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_')
    const name  = friendlyName.trim() || topic

    addDevice({
      mqttTopic:    topic,
      friendlyName: name,
      ipAddress:    ipAddress.trim() || undefined,
      addedVia:     'manual',
    })

    pollScheduler.refresh()
    handleClose()
  }

  const isIpValid = IP_REGEX.test(ipAddress.trim())

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Device</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">

          {/* IP Address with Check button */}
          <div className="space-y-1.5">
            <Label htmlFor="ip">IP Address <span className="text-muted-foreground font-normal">(recommended)</span></Label>
            <div className="flex gap-2">
              <Input
                id="ip"
                value={ipAddress}
                onChange={e => { setIpAddress(e.target.value); setValidation('idle'); setPreview(null) }}
                onKeyDown={e => e.key === 'Enter' && isIpValid && handleCheckIP()}
                placeholder="192.168.1.100"
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!isIpValid || validation === 'checking'}
                onClick={handleCheckIP}
                className="gap-1.5 shrink-0"
              >
                {validation === 'checking'
                  ? <Loader2 size={14} className="animate-spin" />
                  : <Search size={14} />}
                Check
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Required for HTTP-only mode. Make sure <code className="bg-muted px-1 rounded font-mono">SetOption120 1</code> is set.
            </p>
          </div>

          {/* IP Validation result */}
          {validation === 'found' && preview && (
            <div className="flex items-start gap-2.5 p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-sm">
              <CheckCircle size={16} className="text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">{preview.friendlyName}</p>
                <p className="text-muted-foreground text-xs">{preview.hardware} · {preview.firmware}</p>
              </div>
            </div>
          )}

          {validation === 'error' && (
            <div className="flex items-start gap-2.5 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm">
              <AlertCircle size={16} className="text-destructive shrink-0 mt-0.5" />
              <p className="text-destructive text-xs">{errorMsg}</p>
            </div>
          )}

          {/* Friendly Name */}
          <div className="space-y-1.5">
            <Label htmlFor="name">Friendly Name</Label>
            <Input
              id="name"
              value={friendlyName}
              onChange={e => setFriendlyName(e.target.value)}
              placeholder="e.g., Kitchen Light"
            />
          </div>

          {/* MQTT Topic */}
          <div className="space-y-1.5">
            <Label htmlFor="topic">MQTT Topic <span className="text-muted-foreground font-normal">(for MQTT mode)</span></Label>
            <Input
              id="topic"
              value={mqttTopic}
              onChange={e => setMqttTopic(e.target.value)}
              placeholder="e.g., tasmota_ABC123"
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              The device's Topic setting without prefix (cmnd/<b>topic</b>/POWER)
            </p>
          </div>

          <div className="flex gap-3 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 gap-1.5"
              disabled={!mqttTopic.trim() && !friendlyName.trim() && !ipAddress.trim()}
            >
              <Plus size={15} />
              Add Device
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function getErrorHint(err: HttpError): string {
  switch (err.type) {
    case 'timeout':  return 'Connection timed out — wrong IP or device offline'
    case 'cors':     return 'CORS blocked — run SetOption120 1 on device'
    case 'auth':     return 'Unauthorized — check device password'
    case 'network':  return 'Network error — check WiFi and IP address'
    default:         return 'Could not reach device at this IP'
  }
}
