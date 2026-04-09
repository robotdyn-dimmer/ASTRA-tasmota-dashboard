import { useState, type ReactNode } from 'react'
import { Header } from './Header'
import { Sidebar } from './Sidebar'
import type { ConnectionState } from '@/core/mqtt/types'

interface AppLayoutProps {
  children: ReactNode
  mqttStatus: ConnectionState
  onAddDevice: () => void
  deviceCount: number
  onlineCount: number
}

export function AppLayout({ children, mqttStatus, onAddDevice, deviceCount, onlineCount }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        deviceCount={deviceCount}
        onlineCount={onlineCount}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          mqttStatus={mqttStatus}
          onAddDevice={onAddDevice}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        />

        <main className="flex-1 overflow-auto p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
