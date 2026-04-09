import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Power, RefreshCw, Thermometer, Droplets, Zap, Gauge, Wifi, Trash2, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { useDeviceStore } from '@/features/devices/store/device-store'
import { DeviceStatusBadge } from './DeviceStatusBadge'
import { AstraConfigTab } from './tabs/AstraConfigTab'
import { DeviceRulesTab } from './tabs/DeviceRulesTab'
import { DeviceTimersTab } from './tabs/DeviceTimersTab'
import { DeviceGpioTab } from './tabs/DeviceGpioTab'
import { DeviceConsoleTab } from './tabs/DeviceConsoleTab'
import { mqttClient } from '@/core/mqtt/MqttClient'
import { tasmotaHttp, HttpError } from '@/core/http/tasmota-http-client'
import { buildCommandTopic } from '@/lib/tasmota-topic-utils'
import { parseStatus0, parsePowerState } from '@/shared/utils/tasmota-parsers'
import { pollScheduler } from '@/core/http/poll-scheduler'

function relayDisplayName(relay: string, count: number, device: { relayLabels?: Record<string, string>; friendlyNames?: string[] }): string {
  if (device.relayLabels?.[relay]) return device.relayLabels[relay]
  if (count <= 1) return 'Power'
  const idx = parseInt(relay.replace('POWER', ''), 10) - 1
  if (device.friendlyNames?.[idx]) return device.friendlyNames[idx]
  return relay.replace('POWER', 'Relay ')
}

export function DeviceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const device = useDeviceStore(s => id ? s.devices[id] : undefined)
  const state  = useDeviceStore(s => id ? s.deviceStates[id] : undefined)
  const removeDevice = useDeviceStore(s => s.removeDevice)
  const updateDevice = useDeviceStore(s => s.updateDevice)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue] = useState('')
  const nameInputRef = useRef<HTMLInputElement>(null)

  // Active polling while on this page
  useEffect(() => {
    if (!id || !device?.ipAddress) return
    pollScheduler.startActive(id, device.ipAddress)
    return () => pollScheduler.stopActive()
  }, [id, device?.ipAddress])

  if (!device) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <p className="text-lg font-medium">Device not found</p>
        <div className="flex gap-2 mt-4">
          <Button variant="outline" className="gap-2" onClick={() => navigate('/devices')}>
            <ArrowLeft size={15} /> Back to Devices
          </Button>
          {id && (
            <Button
              variant="destructive"
              className="gap-2"
              onClick={() => {
                useDeviceStore.getState().removeDevice(id)
                navigate('/devices')
              }}
            >
              <Trash2 size={15} /> Remove from list
            </Button>
          )}
        </div>
      </div>
    )
  }

  const sendCommand = async (command: string) => {
    const [cmd, ...args] = command.split(' ')

    // HTTP-primary: always use HTTP when device has an IP address.
    // MQTT is secondary — also publish if connected (faster for MQTT-enabled devices).
    if (device.ipAddress) {
      try {
        const result = await tasmotaHttp.sendCommand(device.ipAddress, command)
        if (result.ok) {
          const store = useDeviceStore.getState()
          const newPower = parsePowerState(result.data)
          if (Object.keys(newPower).length > 0) {
            const existing = store.deviceStates[device.id]?.power ?? {}
            store.updateDeviceState(device.id, {
              online: true, lastSeen: Date.now(),
              power: { ...existing, ...newPower },
            })
          }
        }
      } catch (err) {
        if (err instanceof HttpError) console.error(err.type, err.message)
      }
      // Also publish via MQTT if connected
      if (mqttClient.connectionState === 'connected') {
        mqttClient.publish(buildCommandTopic(device.mqttTopic, cmd), args.join(' ') || '')
      }
    } else if (mqttClient.connectionState === 'connected') {
      // No IP — MQTT only
      mqttClient.publish(buildCommandTopic(device.mqttTopic, cmd), args.join(' ') || '')
    }
  }

  const handleRefresh = async () => {
    if (!device.ipAddress) return
    try {
      const result = await tasmotaHttp.getFullStatus(device.ipAddress)
      const parsed = parseStatus0(result.data)
      const store = useDeviceStore.getState()
      // Never override ipAddress — we keep the address we used to connect
      const { friendlyName, ipAddress: _ip, macAddress, firmwareVersion, hardware, module: mod, ...stateUpdates } = parsed
      const meta: Record<string, unknown> = {}
      if (friendlyName)    meta.friendlyName    = friendlyName
      if (macAddress)      meta.macAddress      = macAddress
      if (firmwareVersion) meta.firmwareVersion = firmwareVersion
      if (hardware)        meta.hardware        = hardware
      if (mod)             meta.module          = mod
      if (Object.keys(meta).length) store.updateDevice(device.id, meta)
      store.updateDeviceState(device.id, { online: true, lastSeen: Date.now(), ...stateUpdates })
    } catch { /* silent */ }
  }

  const saveName = async () => {
    const trimmed = nameValue.trim()
    if (!trimmed || trimmed === device.friendlyName) {
      setEditingName(false)
      return
    }
    // Update store immediately
    updateDevice(device.id, { friendlyName: trimmed })
    // Send to Tasmota device
    if (device.ipAddress) {
      tasmotaHttp.sendCommand(device.ipAddress, `FriendlyName ${trimmed}`).catch(() => {})
    }
    setEditingName(false)
  }

  const powerEntries = Object.entries(state?.power ?? {})
  const sensorEntries = Object.entries(state?.sensors ?? {})
  const energy = state?.energy
  const wifi = state?.wifi

  return (
    <div className="max-w-3xl space-y-5">

      {/* ── Page header ── */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/devices')}>
          <ArrowLeft size={18} />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            {editingName ? (
              <input
                ref={nameInputRef}
                value={nameValue}
                onChange={e => setNameValue(e.target.value)}
                onBlur={() => saveName()}
                onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditingName(false) }}
                className="text-xl font-semibold bg-transparent border-b-2 border-primary outline-none px-0 py-0 w-full max-w-xs"
                autoFocus
              />
            ) : (
              <h1
                className="text-xl font-semibold truncate cursor-pointer group/name flex items-center gap-2 hover:text-primary transition-colors"
                onClick={() => { setNameValue(device.friendlyName); setEditingName(true) }}
                title="Click to rename"
              >
                {device.friendlyName}
                <Pencil size={14} className="text-muted-foreground/30 group-hover/name:text-primary/50 shrink-0" />
              </h1>
            )}
            <DeviceStatusBadge online={state?.online ?? false} />
          </div>
          <p className="text-sm text-muted-foreground font-mono mt-0.5 truncate">
            {device.ipAddress || device.mqttTopic}
          </p>
        </div>
        {device.ipAddress && (
          <Button variant="outline" size="icon" onClick={handleRefresh} title="Refresh">
            <RefreshCw size={16} />
          </Button>
        )}
        {confirmDelete ? (
          <div className="flex items-center gap-2 shrink-0">
            <Button size="sm" variant="destructive" onClick={() => { removeDevice(device.id); navigate('/devices') }}>
              Delete
            </Button>
            <Button size="sm" variant="outline" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button variant="outline" size="icon" onClick={() => setConfirmDelete(true)} title="Remove device" className="text-muted-foreground hover:text-destructive hover:border-destructive/40">
            <Trash2 size={16} />
          </Button>
        )}
      </div>

      {/* ── Tabs ── */}
      <Tabs defaultValue="overview">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="power" disabled={powerEntries.length === 0}>Power</TabsTrigger>
          <TabsTrigger value="sensors" disabled={sensorEntries.length === 0 && !energy}>Sensors</TabsTrigger>
          <TabsTrigger value="wifi" disabled={!wifi}>WiFi</TabsTrigger>
          {device.ipAddress && <TabsTrigger value="gpio">GPIO</TabsTrigger>}
          {device.ipAddress && <TabsTrigger value="rules">Rules</TabsTrigger>}
          {device.ipAddress && <TabsTrigger value="timers">Timers</TabsTrigger>}
          {device.ipAddress && <TabsTrigger value="console">Console</TabsTrigger>}
          {device.ipAddress && <TabsTrigger value="astra">ASTRA</TabsTrigger>}
        </TabsList>

        {/* ── Overview tab ── */}
        <TabsContent value="overview" className="mt-4 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { label: 'Firmware',  value: device.firmwareVersion || '—' },
              { label: 'Hardware',  value: device.hardware        || '—' },
              { label: 'Module',    value: device.module          || '—' },
              { label: 'IP',        value: device.ipAddress       || '—', mono: true },
              { label: 'MAC',       value: device.macAddress      || '—', mono: true },
              { label: 'Uptime',    value: state?.uptime          || '—', mono: true },
            ].map(({ label, value, mono }) => (
              <div key={label} className="bg-card border border-border rounded-lg p-3">
                <p className="text-xs text-muted-foreground mb-1">{label}</p>
                <p className={`text-sm font-medium truncate ${mono ? 'font-mono' : ''}`}>{value}</p>
              </div>
            ))}
          </div>

          {state && (
            <div className="grid grid-cols-3 gap-3">
              <StatBox
                label="RSSI"
                value={wifi ? `${wifi.rssi}%` : '—'}
                sub={wifi ? `${wifi.signal} dBm` : undefined}
              />
              <StatBox label="Load Avg" value={state.loadAvg !== undefined ? `${state.loadAvg}%` : '—'} />
              <StatBox
                label="Last seen"
                value={state.lastSeen > 0 ? new Date(state.lastSeen).toLocaleTimeString() : '—'}
              />
            </div>
          )}
        </TabsContent>

        {/* ── Power tab ── */}
        <TabsContent value="power" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Power size={15} /> Relay Control
              </CardTitle>
            </CardHeader>
            <Separator />
            <CardContent className="pt-4">
              {powerEntries.length === 0 ? (
                <p className="text-sm text-muted-foreground">No relay data available</p>
              ) : (
                <div className="space-y-3">
                  {powerEntries.map(([relay, isOn]) => (
                    <div key={relay} className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">
                          {relayDisplayName(relay, powerEntries.length, device)}
                        </p>
                        <p className="text-xs font-mono text-muted-foreground">{relay}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={isOn
                          ? 'border-green-500/40 text-green-600 dark:text-green-400'
                          : 'border-border text-muted-foreground'
                        }>
                          {isOn ? 'ON' : 'OFF'}
                        </Badge>
                        <Button
                          size="sm"
                          variant={isOn ? 'default' : 'outline'}
                          disabled={!state?.online}
                          onClick={() => sendCommand(`${relay} TOGGLE`)}
                          className="gap-1.5"
                        >
                          <Power size={13} /> Toggle
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Sensors tab ── */}
        <TabsContent value="sensors" className="mt-4 space-y-4">
          {sensorEntries.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Thermometer size={15} /> Sensor Readings
                </CardTitle>
              </CardHeader>
              <Separator />
              <CardContent className="pt-4">
                <div className="space-y-2.5">
                  {sensorEntries.map(([key, reading]) => (
                    <div key={key} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <SensorIcon sensorKey={key} />
                        <span className="text-sm font-mono text-muted-foreground">{key}</span>
                      </div>
                      <span className="text-sm font-medium tabular-nums">
                        {typeof reading.value === 'number' ? reading.value.toFixed(1) : reading.value}
                        {reading.unit && <span className="text-muted-foreground ml-1">{reading.unit}</span>}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {energy && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Zap size={15} /> Energy Monitor
                </CardTitle>
              </CardHeader>
              <Separator />
              <CardContent className="pt-4">
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <StatBox label="Power"   value={`${energy.power} W`}    />
                  <StatBox label="Voltage" value={`${energy.voltage} V`}  />
                  <StatBox label="Current" value={`${energy.current} A`}  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <StatBox label="Today"     value={`${energy.today} kWh`}     />
                  <StatBox label="Yesterday" value={`${energy.yesterday} kWh`} />
                  <StatBox label="Total"     value={`${energy.total} kWh`}     />
                  <StatBox label="Factor"    value={`${energy.factor}`}        />
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── WiFi tab ── */}
        <TabsContent value="wifi" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Wifi size={15} /> WiFi Info
              </CardTitle>
            </CardHeader>
            <Separator />
            <CardContent className="pt-4">
              {!wifi ? (
                <p className="text-sm text-muted-foreground">No WiFi data available</p>
              ) : (
                <div className="space-y-3">
                  {[
                    { label: 'SSID',        value: wifi.ssid },
                    { label: 'BSSID',       value: wifi.bssid      || '—', mono: true },
                    { label: 'Channel',     value: wifi.channel !== undefined ? String(wifi.channel) : '—' },
                    { label: 'Signal',      value: `${wifi.signal} dBm` },
                    { label: 'RSSI',        value: `${wifi.rssi}%` },
                    { label: 'Link count',  value: wifi.linkCount !== undefined ? String(wifi.linkCount) : '—' },
                    { label: 'Downtime',    value: wifi.downtime   || '—', mono: true },
                  ].map(({ label, value, mono }) => (
                    <div key={label} className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">{label}</span>
                      <span className={`text-sm font-medium ${mono ? 'font-mono' : ''}`}>{value}</span>
                    </div>
                  ))}

                  {/* Signal strength bar */}
                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>Signal strength</span>
                      <span>{wifi.rssi}%</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          wifi.rssi >= 70 ? 'bg-green-500' :
                          wifi.rssi >= 40 ? 'bg-yellow-500' : 'bg-destructive'
                        }`}
                        style={{ width: `${wifi.rssi}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── GPIO tab ── */}
        {device.ipAddress && (
          <TabsContent value="gpio" className="mt-4">
            <DeviceGpioTab device={device} />
          </TabsContent>
        )}

        {/* ── Rules tab ── */}
        {device.ipAddress && (
          <TabsContent value="rules" className="mt-4">
            <DeviceRulesTab device={device} />
          </TabsContent>
        )}

        {/* ── Timers tab ── */}
        {device.ipAddress && (
          <TabsContent value="timers" className="mt-4">
            <DeviceTimersTab device={device} />
          </TabsContent>
        )}

        {/* ── Console tab ── */}
        {device.ipAddress && (
          <TabsContent value="console" className="mt-4">
            <DeviceConsoleTab device={device} />
          </TabsContent>
        )}

        {/* ── ASTRA config tab ── */}
        {device.ipAddress && (
          <TabsContent value="astra" className="mt-4">
            <AstraConfigTab device={device} state={state} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────────

function StatBox({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-card border border-border rounded-lg p-3 text-center">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-sm font-semibold">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  )
}

function SensorIcon({ sensorKey }: { sensorKey: string }) {
  if (sensorKey.includes('Temperature') || sensorKey.includes('Temp'))
    return <Thermometer size={14} className="text-red-500 dark:text-red-400 shrink-0" />
  if (sensorKey.includes('Humidity') || sensorKey.includes('Humid'))
    return <Droplets size={14} className="text-blue-500 dark:text-blue-400 shrink-0" />
  if (sensorKey.includes('Power') || sensorKey.includes('Energy') || sensorKey.includes('Voltage'))
    return <Zap size={14} className="text-yellow-500 dark:text-yellow-400 shrink-0" />
  return <Gauge size={14} className="text-muted-foreground/70 shrink-0" />
}
