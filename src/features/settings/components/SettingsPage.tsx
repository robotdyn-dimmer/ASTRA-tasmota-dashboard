import { useRef, useState } from 'react'
import { Save, TestTube, Sun, Moon, Download, Upload, CheckCircle, AlertCircle, Lock, Unlock, Puzzle, Trash2, Plus, RefreshCw, Cloud } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useSettingsStore } from '@/features/settings/store/settings-store'
import { useDeviceStore } from '@/features/devices/store/device-store'
import { useDashboardStore } from '@/features/dashboard/store/dashboard-store'
import { useMqttContext } from '@/core/mqtt/MqttProvider'
import { exportConfig, importConfig } from '@/features/settings/utils/backup'

const connectionBadgeClass: Record<string, string> = {
  connected:    'border-green-500/50 text-green-600 dark:text-green-400',
  connecting:   'border-yellow-500/50 text-yellow-600 dark:text-yellow-400',
  disconnected: 'border-destructive/50 text-destructive',
  error:        'border-destructive/50 text-destructive',
}

type ImportState = 'idle' | 'success' | 'error'

export function SettingsPage() {
  const { mqttBrokerUrl, mqttUsername, mqttPassword, autoDiscovery, theme,
          viewerPinHash, widgetPlugins, configDeviceIp, autoSyncEnabled,
          setMqttConfig, setAutoDiscovery, setTheme, setViewerPinHash,
          setConfigDeviceIp, setAutoSyncEnabled, addWidgetPlugin, removeWidgetPlugin } = useSettingsStore()
  const devices = useDeviceStore(s => s.devices)
  const devicesWithIp = Object.values(devices).filter(d => d.ipAddress)
  const { connect, connectionState } = useMqttContext()

  const [url,  setUrl]  = useState(mqttBrokerUrl)
  const [user, setUser] = useState(mqttUsername)
  const [pass, setPass] = useState(mqttPassword)

  const [importState, setImportState] = useState<ImportState>('idle')
  const [importError, setImportError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [syncing,    setSyncing]    = useState(false)
  const [syncMsg,    setSyncMsg]    = useState('')

  const [pluginUrl,     setPluginUrl]     = useState('')
  const [pluginLoading, setPluginLoading] = useState(false)
  const [pluginMsg,     setPluginMsg]     = useState('')

  const [newPin,     setNewPin]     = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [pinMsg,     setPinMsg]     = useState('')
  const [savingPin,  setSavingPin]  = useState(false)

  const handleSave = () => {
    setMqttConfig(url, user, pass)
    connect({ brokerUrl: url, username: user || undefined, password: pass || undefined })
  }

  const handleTest = () => {
    connect({ brokerUrl: url, username: user || undefined, password: pass || undefined })
  }

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.classList.toggle('dark', next === 'dark')
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    const result = await importConfig(file)
    if (result.ok) {
      setImportState('success')
      setTimeout(() => window.location.reload(), 1200)
    } else {
      setImportState('error')
      setImportError(result.error ?? 'Import failed')
      setTimeout(() => setImportState('idle'), 4000)
    }
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <h2 className="text-xl font-semibold">Settings</h2>

      <Tabs defaultValue="mqtt" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="mqtt">MQTT</TabsTrigger>
          <TabsTrigger value="sync">Config & Sync</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
        </TabsList>

        {/* ═══════════ MQTT ═══════════ */}
        <TabsContent value="mqtt" className="space-y-6 mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>MQTT Broker</CardTitle>
                <Badge variant="outline" className={connectionBadgeClass[connectionState]}>
                  {connectionState}
                </Badge>
              </div>
            </CardHeader>
            <Separator />
            <CardContent className="pt-6 space-y-5">
              <div className="space-y-2">
                <Label htmlFor="brokerUrl">Broker URL</Label>
                <Input id="brokerUrl" value={url} onChange={e => setUrl(e.target.value)} placeholder="ws://localhost:9001" />
                <p className="text-xs text-muted-foreground">WebSocket URL (ws:// or wss://)</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input id="username" value={user} onChange={e => setUser(e.target.value)} placeholder="Optional" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" type="password" value={pass} onChange={e => setPass(e.target.value)} placeholder="Optional" />
                </div>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={handleTest} className="gap-2">
                  <TestTube size={15} /> Test Connection
                </Button>
                <Button onClick={handleSave} className="gap-2">
                  <Save size={15} /> Save & Connect
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Device Discovery</CardTitle></CardHeader>
            <Separator />
            <CardContent className="pt-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">Auto-discover devices</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Automatically detect new Tasmota devices via MQTT LWT
                  </p>
                </div>
                <Switch checked={autoDiscovery} onCheckedChange={setAutoDiscovery} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════════ Config & Sync ═══════════ */}
        <TabsContent value="sync" className="space-y-6 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Cloud size={16} />
                Config Sync Device
              </CardTitle>
            </CardHeader>
            <Separator />
            <CardContent className="pt-6 space-y-4">
              <p className="text-sm text-muted-foreground">
                Select a Tasmota device to store shared dashboard config. Any browser pointing to the same device will load the same dashboard layout.
              </p>

              {devicesWithIp.length === 0 ? (
                <p className="text-xs text-muted-foreground/70 bg-muted rounded-md p-3">
                  No devices with an IP address configured. Add a device first.
                </p>
              ) : (
                <select
                  value={configDeviceIp}
                  onChange={e => { setConfigDeviceIp(e.target.value); setSyncMsg('') }}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">(none — local browser only)</option>
                  {devicesWithIp.map(d => (
                    <option key={d.id} value={d.ipAddress!}>
                      {d.friendlyName} ({d.ipAddress})
                    </option>
                  ))}
                </select>
              )}

              {configDeviceIp && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={syncing}
                      className="gap-1.5"
                      onClick={async () => {
                        setSyncing(true)
                        setSyncMsg('')
                        try {
                          const { tasmotaHttp } = await import('@/core/http/tasmota-http-client')
                          const { loadAppConfig } = await import('@/core/config/config-sync')
                          const loaded = await loadAppConfig(configDeviceIp)
                          setSyncMsg(loaded ? '✓ Config loaded from device' : '✗ No config on device or unreachable')
                        } catch {
                          setSyncMsg('✗ Pull failed')
                        } finally {
                          setSyncing(false)
                        }
                      }}
                    >
                      {syncing ? <RefreshCw size={13} className="animate-spin" /> : <Download size={13} />}
                      Pull from device
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={syncing}
                      className="gap-1.5"
                      onClick={async () => {
                        setSyncing(true)
                        setSyncMsg('')
                        try {
                          const { tasmotaHttp } = await import('@/core/http/tasmota-http-client')
                          const dashStore = useDashboardStore.getState()
                          const settingsState = useSettingsStore.getState()
                          const devicesState = (await import('@/features/devices/store/device-store')).useDeviceStore.getState()
                          const saved = await tasmotaHttp.saveAppConfig(configDeviceIp, {
                            version: 1,
                            savedAt: Date.now(),
                            settings: {
                              mqttBrokerUrl:  settingsState.mqttBrokerUrl,
                              mqttUsername:   settingsState.mqttUsername,
                              mqttPassword:   settingsState.mqttPassword,
                              autoDiscovery:  settingsState.autoDiscovery,
                              widgetPlugins:  settingsState.widgetPlugins,
                              configDeviceIp: settingsState.configDeviceIp,
                            },
                            devices:           devicesState.devices,
                            dashboards:        dashStore.dashboards,
                            activeDashboardId: dashStore.activeDashboardId,
                          })
                          setSyncMsg(saved ? '✓ Config saved to device' : '✗ Save failed')
                        } catch {
                          setSyncMsg('✗ Push failed')
                        } finally {
                          setSyncing(false)
                        }
                      }}
                    >
                      <Upload size={13} />
                      Push to device
                    </Button>
                  </div>
                  {syncMsg && (
                    <span className={`text-xs ${syncMsg.startsWith('✓') ? 'text-green-600 dark:text-green-400' : 'text-destructive'}`}>
                      {syncMsg}
                    </span>
                  )}
                </div>
              )}

              <Separator />

              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">Auto-sync</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Automatically push config changes to device every 2 seconds
                  </p>
                </div>
                <Switch checked={autoSyncEnabled} onCheckedChange={setAutoSyncEnabled} />
              </div>

              <p className="text-xs text-muted-foreground/60">
                Requires Berry script <code className="font-mono bg-muted px-1 rounded">astra_config.be</code> on the device.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Data</CardTitle></CardHeader>
            <Separator />
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">Export config</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Download devices, dashboards, and settings as a JSON backup
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={exportConfig} className="gap-2 shrink-0">
                  <Download size={15} /> Export
                </Button>
              </div>

              <Separator />

              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">Import config</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Restore from a backup file — app will reload automatically
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="gap-2 shrink-0"
                >
                  <Upload size={15} /> Import
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={handleImport}
                />
              </div>

              {importState === 'success' && (
                <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                  <CheckCircle size={15} /> Import successful — reloading...
                </div>
              )}
              {importState === 'error' && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle size={15} /> {importError}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════════ Security ═══════════ */}
        <TabsContent value="security" className="space-y-6 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock size={16} />
                Admin PIN
              </CardTitle>
            </CardHeader>
            <Separator />
            <CardContent className="pt-6 space-y-4">
              <div className="text-sm text-muted-foreground space-y-1">
                <p>Set an admin PIN to show a lock screen on startup.</p>
                <p className="text-xs text-muted-foreground/70">
                  Convenience only — not a security barrier. Anyone with DevTools can bypass it.
                </p>
              </div>

              <div className="flex items-center gap-2">
                {viewerPinHash ? (
                  <div className="flex items-center gap-2 text-sm">
                    <Lock size={14} className="text-primary" />
                    <span className="text-muted-foreground">PIN is set</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm">
                    <Unlock size={14} className="text-muted-foreground" />
                    <span className="text-muted-foreground">No PIN (open access)</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">New PIN</Label>
                  <Input
                    type="password"
                    inputMode="numeric"
                    value={newPin}
                    onChange={e => { setNewPin(e.target.value); setPinMsg('') }}
                    placeholder="4+ digits"
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Confirm PIN</Label>
                  <Input
                    type="password"
                    inputMode="numeric"
                    value={confirmPin}
                    onChange={e => { setConfirmPin(e.target.value); setPinMsg('') }}
                    placeholder="Repeat PIN"
                    className="h-9"
                  />
                </div>
              </div>

              {pinMsg && (
                <p className={`text-xs ${pinMsg.startsWith('✓') ? 'text-green-600 dark:text-green-400' : 'text-destructive'}`}>
                  {pinMsg}
                </p>
              )}

              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={savingPin}
                  onClick={async () => {
                    if (newPin.length < 4) { setPinMsg('PIN must be at least 4 characters'); return }
                    if (newPin !== confirmPin) { setPinMsg('PINs do not match'); return }
                    setSavingPin(true)
                    const { sha256 } = await import('@/core/auth/role-store')
                    const hash = await sha256(newPin)
                    setViewerPinHash(hash)
                    setNewPin(''); setConfirmPin('')
                    setPinMsg('✓ PIN saved — will take effect on next page load')
                    setSavingPin(false)
                  }}
                >
                  {savingPin ? 'Saving…' : 'Set PIN'}
                </Button>
                {viewerPinHash && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setViewerPinHash('')
                      setPinMsg('✓ PIN removed')
                      setNewPin(''); setConfirmPin('')
                    }}
                  >
                    Remove PIN
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

        </TabsContent>

        {/* ═══════════ Appearance ═══════════ */}
        <TabsContent value="appearance" className="space-y-6 mt-4">
          <Card>
            <CardHeader><CardTitle>Theme</CardTitle></CardHeader>
            <Separator />
            <CardContent className="pt-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">Color mode</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Switch between light and dark mode</p>
                </div>
                <Button variant="outline" size="sm" onClick={toggleTheme} className="gap-2 min-w-28">
                  {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
                  {theme === 'dark' ? 'Light mode' : 'Dark mode'}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Puzzle size={16} />
                Widget Plugins
              </CardTitle>
            </CardHeader>
            <Separator />
            <CardContent className="pt-6 space-y-4">
              <div className="text-sm text-muted-foreground space-y-1">
                <p>Load custom widgets from external ESM module URLs.</p>
                <p className="text-xs text-muted-foreground/70">
                  Only load plugins from sources you trust — they run with full page access.
                </p>
              </div>

              {widgetPlugins.length > 0 && (
                <div className="space-y-1.5">
                  {widgetPlugins.map(url => (
                    <div key={url} className="flex items-center gap-2 p-2 bg-muted rounded-md">
                      <Puzzle size={13} className="text-muted-foreground shrink-0" />
                      <span className="text-xs font-mono flex-1 truncate text-muted-foreground">{url}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => removeWidgetPlugin(url)}
                      >
                        <Trash2 size={12} />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <Input
                  value={pluginUrl}
                  onChange={e => { setPluginUrl(e.target.value); setPluginMsg('') }}
                  placeholder="https://example.com/my-widget/index.js"
                  className="h-9 text-xs font-mono"
                />
                <Button
                  size="sm"
                  className="gap-1.5 shrink-0"
                  disabled={!pluginUrl.trim() || pluginLoading}
                  onClick={async () => {
                    const trimmed = pluginUrl.trim()
                    if (!trimmed.startsWith('http')) { setPluginMsg('Must be an https:// URL'); return }
                    setPluginLoading(true)
                    setPluginMsg('')
                    try {
                      const { loadPlugin } = await import('@/features/widgets/registry/plugin-loader')
                      const result = await loadPlugin(trimmed)
                      if (result.status === 'ok') {
                        addWidgetPlugin(trimmed)
                        setPluginUrl('')
                        setPluginMsg(`✓ Loaded: ${result.types?.join(', ') || 'no new types'}`)
                      } else {
                        setPluginMsg(`Error: ${result.error}`)
                      }
                    } catch (err) {
                      setPluginMsg(`Error: ${String(err)}`)
                    } finally {
                      setPluginLoading(false)
                    }
                  }}
                >
                  {pluginLoading ? '…' : <><Plus size={13} /> Add</>}
                </Button>
              </div>

              {pluginMsg && (
                <p className={`text-xs ${pluginMsg.startsWith('✓') ? 'text-green-600 dark:text-green-400' : 'text-destructive'}`}>
                  {pluginMsg}
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
