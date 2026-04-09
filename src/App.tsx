import { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { MqttProvider, useMqttContext } from '@/core/mqtt/MqttProvider'
import { AppLayout } from '@/shared/layouts/AppLayout'
import { AddDeviceDialog } from '@/features/devices/components/AddDeviceDialog'
import { DashboardPage } from '@/features/dashboard/components/DashboardPage'
import { DeviceList } from '@/features/devices/components/DeviceList'
import { DeviceDetailPage } from '@/features/devices/components/DeviceDetailPage'
import { TimerEditorPage } from '@/features/devices/components/TimerEditorPage'
import { PinLockScreen } from '@/core/auth/PinLockScreen'
import { SettingsPage } from '@/features/settings/components/SettingsPage'
import { AboutPage } from '@/features/about/components/AboutPage'
import { useSettingsStore } from '@/features/settings/store/settings-store'
import { useDeviceStore } from '@/features/devices/store/device-store'
import { startDeviceMqttHandler, stopDeviceMqttHandler } from '@/features/devices/services/device-mqtt-handler'
import { requestAllDevicesStatus } from '@/features/devices/services/device-discovery'
import { pollScheduler } from '@/core/http/poll-scheduler'
import { deviceSseManager } from '@/core/sse/device-sse-manager'
import { loadAppConfig, startConfigSync, stopConfigSync } from '@/core/config/config-sync'

// Register all built-in widgets
import '@/features/widgets'
import { loadAllPlugins } from '@/features/widgets/registry/plugin-loader'

function LoadingSpinner() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <Loader2 size={28} className="animate-spin" />
        <span className="text-sm">Connecting to devices…</span>
      </div>
    </div>
  )
}

function AppContent() {
  const [showAddDevice, setShowAddDevice] = useState(false)
  const [devicesReady, setDevicesReady] = useState(false)
  const { connectionState, connect } = useMqttContext()
  const { mqttBrokerUrl, mqttUsername, mqttPassword } = useSettingsStore()

  const devices = useDeviceStore((s) => s.devices)
  const deviceStates = useDeviceStore((s) => s.deviceStates)
  const deviceCount = Object.keys(devices).length
  const onlineCount = Object.values(deviceStates).filter(s => s.online).length

  const viewerPinHash = useSettingsStore(s => s.viewerPinHash)
  const [pinUnlocked, setPinUnlocked]       = useState(!viewerPinHash)

  // Bootstrap: check ?ip= URL param, load config from device, then connect
  useEffect(() => {
    async function bootstrap() {
      // Step 1: Check URL param ?ip=X → set as config device
      const params = new URLSearchParams(window.location.search)
      const ipParam = params.get('ip')
      if (ipParam) {
        useSettingsStore.getState().setConfigDeviceIp(ipParam)
        const url = new URL(window.location.href)
        url.searchParams.delete('ip')
        window.history.replaceState({}, '', url.pathname + url.search)
      }

      // Step 2: Load config from hub device (if configured)
      const configIp = useSettingsStore.getState().configDeviceIp
      if (configIp) {
        await loadAppConfig(configIp).catch(() => {})
      }

      // Step 3: Connect MQTT (credentials may have come from device)
      const settings = useSettingsStore.getState()
      connect({
        brokerUrl: settings.mqttBrokerUrl,
        username: settings.mqttUsername || undefined,
        password: settings.mqttPassword || undefined,
      })

      // Step 4: Initial poll — wait for device states, then show content
      await pollScheduler.initialPoll()
      setDevicesReady(true)

      // Step 5: Start background services (skip initial poll — just did one)
      pollScheduler.start(true)
      deviceSseManager.start()
      startConfigSync()

      // Step 6: Load external widget plugins
      if (settings.widgetPlugins.length > 0) {
        loadAllPlugins(settings.widgetPlugins).catch(console.error)
      }
    }

    bootstrap()
    return () => { pollScheduler.stop(); deviceSseManager.stop(); stopConfigSync() }
  }, [])

  // Start MQTT handler when connected
  useEffect(() => {
    if (connectionState === 'connected') {
      startDeviceMqttHandler()
      requestAllDevicesStatus()
    }
    return () => { stopDeviceMqttHandler() }
  }, [connectionState])

  if (!pinUnlocked) {
    return <PinLockScreen onUnlocked={() => setPinUnlocked(true)} />
  }

  return (
    <AppLayout
      mqttStatus={connectionState}
      onAddDevice={() => setShowAddDevice(true)}
      deviceCount={deviceCount}
      onlineCount={onlineCount}
    >
      {!devicesReady ? <LoadingSpinner /> : (
        <Routes>
          <Route path="/"              element={<DashboardPage />} />
          <Route path="/devices"       element={<DeviceList />} />
          <Route path="/devices/:id"         element={<DeviceDetailPage />} />
          <Route path="/devices/:id/timers"  element={<TimerEditorPage />} />
          <Route path="/settings"      element={<SettingsPage />} />
          <Route path="/about"         element={<AboutPage />} />
          <Route path="*"              element={<Navigate to="/" replace />} />
        </Routes>
      )}

      <AddDeviceDialog open={showAddDevice} onClose={() => setShowAddDevice(false)} />
    </AppLayout>
  )
}

export default function App() {
  return (
    <MqttProvider>
      <TooltipProvider>
        <AppContent />
      </TooltipProvider>
    </MqttProvider>
  )
}
