import { useState, useEffect } from 'react'
import { MqttProvider, useMqttContext } from '@/core/mqtt/MqttProvider'
import { AppLayout } from '@/shared/layouts/AppLayout'
import { DeviceList } from '@/features/devices/components/DeviceList'
import { AddDeviceDialog } from '@/features/devices/components/AddDeviceDialog'
import { DashboardPage } from '@/features/dashboard/components/DashboardPage'
import { SettingsPage } from '@/features/settings/components/SettingsPage'
import { useSettingsStore } from '@/features/settings/store/settings-store'
import { useDeviceStore } from '@/features/devices/store/device-store'
import { startDeviceMqttHandler, stopDeviceMqttHandler } from '@/features/devices/services/device-mqtt-handler'
import { requestAllDevicesStatus } from '@/features/devices/services/device-discovery'

// Register all built-in widgets
import '@/features/widgets'

function AppContent() {
  const [activePage, setActivePage] = useState('dashboard')
  const [showAddDevice, setShowAddDevice] = useState(false)
  const { connectionState, connect } = useMqttContext()
  const { mqttBrokerUrl, mqttUsername, mqttPassword } = useSettingsStore()

  const devices = useDeviceStore((s) => s.devices)
  const deviceStates = useDeviceStore((s) => s.deviceStates)
  const deviceCount = Object.keys(devices).length
  const onlineCount = Object.values(deviceStates).filter(s => s.online).length

  // Connect to MQTT on mount
  useEffect(() => {
    connect({
      brokerUrl: mqttBrokerUrl,
      username: mqttUsername || undefined,
      password: mqttPassword || undefined,
    })
  }, [])

  // Start MQTT handler when connected
  useEffect(() => {
    if (connectionState === 'connected') {
      startDeviceMqttHandler()
      requestAllDevicesStatus()
    }
    return () => { stopDeviceMqttHandler() }
  }, [connectionState])

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard':
        return <DashboardPage />
      case 'devices':
        return <DeviceList />
      case 'settings':
        return <SettingsPage />
      default:
        return <DashboardPage />
    }
  }

  return (
    <AppLayout
      mqttStatus={connectionState}
      activePage={activePage}
      onNavigate={setActivePage}
      onAddDevice={() => setShowAddDevice(true)}
      deviceCount={deviceCount}
      onlineCount={onlineCount}
    >
      {renderPage()}
      <AddDeviceDialog open={showAddDevice} onClose={() => setShowAddDevice(false)} />
    </AppLayout>
  )
}

export default function App() {
  return (
    <MqttProvider>
      <AppContent />
    </MqttProvider>
  )
}
