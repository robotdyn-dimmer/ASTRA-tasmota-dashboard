import { useState } from 'react'
import { Wifi, CheckCircle, AlertCircle, Loader2, MonitorSmartphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { tasmotaHttp, HttpError } from '@/core/http/tasmota-http-client'
import { pollScheduler } from '@/core/http/poll-scheduler'
import { useDeviceStore } from '@/features/devices/store/device-store'
import { useSettingsStore } from '@/features/settings/store/settings-store'
import { parseStatus0 } from '@/shared/utils/tasmota-parsers'
import { loadAppConfig } from '@/core/config/config-sync'

type Step = 'enter-ip' | 'validating' | 'found' | 'error'

interface FoundDevice {
  friendlyName: string
  firmware:     string
  hardware:     string
  ip:           string
}

interface OnboardingPageProps {
  onComplete: () => void
}

export function OnboardingPage({ onComplete }: OnboardingPageProps) {
  const [ip, setIp] = useState('')
  const [step, setStep] = useState<Step>('enter-ip')
  const [found, setFound] = useState<FoundDevice | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  const addDevice = useDeviceStore(s => s.addDevice)
  const setConfigDeviceIp = useSettingsStore(s => s.setConfigDeviceIp)

  const handleValidate = async () => {
    const trimmed = ip.trim()
    if (!trimmed) return

    setStep('validating')
    setErrorMsg('')

    try {
      const result = await tasmotaHttp.getFullStatus(trimmed)
      const parsed = parseStatus0(result.data)

      setFound({
        friendlyName: parsed.friendlyName || trimmed,
        firmware:     parsed.firmwareVersion || 'Unknown',
        hardware:     parsed.hardware || 'Unknown',
        ip:           trimmed,
      })
      setStep('found')
    } catch (err) {
      const msg = err instanceof HttpError
        ? getErrorHint(err)
        : 'Could not reach device. Check the IP address.'
      setErrorMsg(msg)
      setStep('error')
    }
  }

  const handleAdd = async () => {
    if (!found) return

    addDevice({
      mqttTopic:    found.friendlyName.toLowerCase().replace(/\s+/g, '_'),
      friendlyName: found.friendlyName,
      ipAddress:    found.ip,
      addedVia:     'manual',
    })
    setConfigDeviceIp(found.ip)

    // Load existing config from device (if another browser already configured it)
    await loadAppConfig(found.ip).catch(() => {})

    // Trigger immediate poll so device shows online right away
    pollScheduler.refresh()
    onComplete()
  }

  const handleSkip = () => {
    onComplete()
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-primary/10 rounded-full">
              <MonitorSmartphone size={32} className="text-primary" />
            </div>
          </div>
          <h1 className="text-2xl font-semibold">Welcome to TASMOTA<span className="text-primary">Admin</span></h1>
          <p className="text-muted-foreground text-sm mt-2">
            Connect to your first Tasmota device to get started
          </p>
        </div>

        {/* Main card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add your first device</CardTitle>
          </CardHeader>
          <Separator />
          <CardContent className="pt-5 space-y-4">

            {/* Step: enter IP */}
            {(step === 'enter-ip' || step === 'validating') && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="deviceIp">Device IP Address</Label>
                  <Input
                    id="deviceIp"
                    value={ip}
                    onChange={e => setIp(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleValidate()}
                    placeholder="192.168.1.100"
                    disabled={step === 'validating'}
                    autoFocus
                  />
                  <div className="text-xs text-muted-foreground space-y-1.5">
                    <p>
                      Find the IP in Tasmota web UI: <strong>Information</strong> tab, or check your router's DHCP client list.
                    </p>
                    <details className="cursor-pointer">
                      <summary className="text-primary hover:underline">Connection not working?</summary>
                      <ul className="mt-1.5 ml-3 list-disc space-y-1">
                        <li>Run <code className="font-mono bg-muted px-1 rounded">SetOption120 1</code> in the Tasmota console to enable CORS</li>
                        <li>Make sure your phone/PC is on the same WiFi network as the device</li>
                        <li>Try opening <code className="font-mono bg-muted px-1 rounded">http://&lt;device-ip&gt;</code> in a browser tab — if Tasmota UI loads, the IP is correct</li>
                        <li>Assign a static IP to the device for reliable access</li>
                      </ul>
                    </details>
                  </div>
                </div>

                <Button
                  className="w-full gap-2"
                  onClick={handleValidate}
                  disabled={!ip.trim() || step === 'validating'}
                >
                  {step === 'validating' ? (
                    <><Loader2 size={16} className="animate-spin" /> Connecting...</>
                  ) : (
                    <><Wifi size={16} /> Connect to Device</>
                  )}
                </Button>
              </>
            )}

            {/* Step: device found */}
            {step === 'found' && found && (
              <>
                <div className="flex items-start gap-3 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                  <CheckCircle size={20} className="text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                  <div className="space-y-1 text-sm">
                    <p className="font-medium">{found.friendlyName}</p>
                    <p className="text-muted-foreground font-mono text-xs">{found.ip}</p>
                    <p className="text-muted-foreground text-xs">{found.hardware} · {found.firmware}</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1" onClick={() => setStep('enter-ip')}>
                    Back
                  </Button>
                  <Button className="flex-1" onClick={handleAdd}>
                    Add Device
                  </Button>
                </div>
              </>
            )}

            {/* Step: error */}
            {step === 'error' && (
              <>
                <div className="flex items-start gap-3 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <AlertCircle size={20} className="text-destructive shrink-0 mt-0.5" />
                  <p className="text-sm text-destructive">{errorMsg}</p>
                </div>

                <Button className="w-full" variant="outline" onClick={() => setStep('enter-ip')}>
                  Try Again
                </Button>
              </>
            )}

          </CardContent>
        </Card>

        {/* Skip option */}
        <div className="text-center">
          <button
            onClick={handleSkip}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Skip for now — I'll add devices manually
          </button>
        </div>

        {/* Using mock server hint in dev */}
        {import.meta.env.DEV && (
          <Card className="border-dashed">
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground font-medium mb-1">Dev mode — mock server</p>
              <p className="text-xs text-muted-foreground">
                Try: <code className="font-mono bg-muted px-1 rounded">localhost:8888/device/1</code>
                {' '}(run <code className="font-mono bg-muted px-1 rounded">npm run dev</code> in <code className="font-mono bg-muted px-1 rounded">mock-server/</code>)
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

function getErrorHint(err: HttpError): string {
  switch (err.type) {
    case 'timeout':
      return 'Connection timed out. Device is unreachable or IP is wrong.'
    case 'cors':
      return 'CORS blocked. Run SetOption120 1 in the Tasmota console on your device.'
    case 'auth':
      return 'Access denied. Set device password in Settings after adding.'
    case 'network':
      return 'Network error. Make sure you are on the same WiFi network as the device.'
    default:
      return 'Could not reach device. Check the IP address and try again.'
  }
}
