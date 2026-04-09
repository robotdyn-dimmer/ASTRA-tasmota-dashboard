/**
 * ASTRA Config Tab — reads and writes /astra_cfg on the device (Berry endpoint).
 * Allows customizing relay labels, sensor filter, teleperiod, and notes.
 */

import { useEffect, useState } from 'react'
import { Save, Loader2, CheckCircle, AlertCircle, Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { tasmotaHttp } from '@/core/http/tasmota-http-client'
import { useDeviceStore } from '@/features/devices/store/device-store'
import type { TasmotaDevice, DeviceState } from '@/features/devices/store/device-store.types'

interface AstraConfig {
  version:      number
  relayLabels?: Record<string, string>   // { POWER: "Kitchen Light" }
  sensorFilter?: string[]                // ["AM2301.Temperature"]
  teleperiod?:  number
  notes?:       string
}

interface Props {
  device: TasmotaDevice
  state:  DeviceState | undefined
}

type LoadState = 'loading' | 'ready' | 'no-ip' | 'error'
type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export function AstraConfigTab({ device, state }: Props) {
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [config, setConfig]       = useState<AstraConfig>({ version: 1 })
  const [relayLabels, setRelayLabels] = useState<Record<string, string>>({})
  const [sensorFilter, setSensorFilter] = useState<string>('')
  const [teleperiod, setTeleperiod]     = useState<string>('')
  const [notes, setNotes]               = useState<string>('')

  const relayKeys    = Object.keys(state?.power ?? {})
  const sensorKeys   = Object.keys(state?.sensors ?? {})

  // Fetch config on mount
  useEffect(() => {
    if (!device.ipAddress) { setLoadState('no-ip'); return }
    fetchConfig()
  }, [device.ipAddress])

  const fetchConfig = async () => {
    setLoadState('loading')
    try {
      const data = await tasmotaHttp.getAstraConfig(device.ipAddress!)
      const cfg = data as unknown as AstraConfig
      setConfig(cfg)
      setRelayLabels(cfg.relayLabels ?? {})
      setSensorFilter((cfg.sensorFilter ?? []).join(', '))
      setTeleperiod(cfg.teleperiod !== undefined ? String(cfg.teleperiod) : '')
      setNotes(cfg.notes ?? '')
      // Sync labels into device store
      useDeviceStore.getState().updateDevice(device.id, {
        relayLabels: cfg.relayLabels ?? {},
        notes: cfg.notes ?? '',
      })
      setLoadState('ready')
    } catch {
      setLoadState('error')
    }
  }

  const handleSave = async () => {
    if (!device.ipAddress) return
    setSaveState('saving')

    // Build filter array from comma-separated string
    const filterArr = sensorFilter
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)

    const updated: AstraConfig = {
      version:      config.version ?? 1,
      relayLabels:  Object.keys(relayLabels).length > 0 ? relayLabels : undefined,
      sensorFilter: filterArr.length > 0 ? filterArr : undefined,
      teleperiod:   teleperiod ? Number(teleperiod) : undefined,
      notes:        notes.trim() || undefined,
    }

    const ok = await tasmotaHttp.saveAstraConfig(device.ipAddress, updated as unknown as Record<string, unknown>)
    setSaveState(ok ? 'saved' : 'error')
    if (ok) {
      setConfig(updated)
      // Push labels into device store so widgets see them immediately
      useDeviceStore.getState().updateDevice(device.id, {
        relayLabels: updated.relayLabels ?? {},
        notes: updated.notes ?? '',
      })
      setTimeout(() => setSaveState('idle'), 2500)
    }
  }

  // ── Render states ─────────────────────────────────────────────────────────

  if (loadState === 'no-ip') {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
        <Settings2 size={32} className="opacity-30" />
        <p className="text-sm font-medium">No IP address configured</p>
        <p className="text-xs">Add an IP address to this device to use ASTRA config</p>
      </div>
    )
  }

  if (loadState === 'loading') {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={24} className="animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (loadState === 'error') {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
        <AlertCircle size={32} className="text-destructive opacity-70" />
        <p className="text-sm font-medium">Could not load ASTRA config</p>
        <p className="text-xs text-center max-w-xs">
          Make sure <code className="font-mono bg-muted px-1 rounded">astra_config.be</code> is installed on the device
          and <code className="font-mono bg-muted px-1 rounded">SetOption120 1</code> is set.
        </p>
        <Button variant="outline" size="sm" onClick={fetchConfig}>Try again</Button>
      </div>
    )
  }

  // ── Ready ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">

      {/* Relay Labels */}
      {relayKeys.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Relay Labels</CardTitle>
          </CardHeader>
          <Separator />
          <CardContent className="pt-4 space-y-3">
            <p className="text-xs text-muted-foreground">
              Custom names for relay buttons shown in widgets and device cards.
            </p>
            {relayKeys.map(relay => (
              <div key={relay} className="flex items-center gap-3">
                <Badge variant="outline" className="font-mono text-xs w-20 justify-center shrink-0">
                  {relay}
                </Badge>
                <Input
                  value={relayLabels[relay] ?? ''}
                  onChange={e => setRelayLabels(prev => ({ ...prev, [relay]: e.target.value }))}
                  placeholder={`e.g., ${relay === 'POWER' ? 'Main Light' : `Relay ${relay.replace('POWER', '')}`}`}
                  className="flex-1"
                />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Sensor Filter */}
      {sensorKeys.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Sensor Display Filter</CardTitle>
          </CardHeader>
          <Separator />
          <CardContent className="pt-4 space-y-3">
            <p className="text-xs text-muted-foreground">
              Comma-separated sensor keys to show in widgets. Leave empty to show all.
            </p>
            <Input
              value={sensorFilter}
              onChange={e => setSensorFilter(e.target.value)}
              placeholder="AM2301.Temperature, AM2301.Humidity"
              className="font-mono text-sm"
            />
            {/* Available keys */}
            <div className="flex flex-wrap gap-1.5">
              {sensorKeys.map(key => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    const current = sensorFilter.split(',').map(s => s.trim()).filter(Boolean)
                    if (!current.includes(key)) {
                      setSensorFilter([...current, key].join(', '))
                    }
                  }}
                  className="text-xs font-mono px-2 py-0.5 rounded bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {key}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Teleperiod + Notes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Advanced</CardTitle>
        </CardHeader>
        <Separator />
        <CardContent className="pt-4 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="teleperiod">Telemetry interval (seconds)</Label>
            <Input
              id="teleperiod"
              type="number"
              min={10}
              max={3600}
              value={teleperiod}
              onChange={e => setTeleperiod(e.target.value)}
              placeholder="300 (default)"
              className="w-40"
            />
            <p className="text-xs text-muted-foreground">
              How often device sends sensor data. 30s recommended for dashboard use.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Input
              id="notes"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g., Kitchen ceiling light, zone A"
            />
          </div>
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex items-center gap-3">
        <Button
          onClick={handleSave}
          disabled={saveState === 'saving'}
          className="gap-2"
        >
          {saveState === 'saving'
            ? <><Loader2 size={15} className="animate-spin" /> Saving...</>
            : <><Save size={15} /> Save to Device</>}
        </Button>

        {saveState === 'saved' && (
          <span className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
            <CheckCircle size={15} /> Saved successfully
          </span>
        )}
        {saveState === 'error' && (
          <span className="flex items-center gap-1.5 text-sm text-destructive">
            <AlertCircle size={15} /> Save failed
          </span>
        )}
      </div>
    </div>
  )
}
