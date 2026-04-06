import { useState, type ReactNode } from 'react'
import { Header } from './Header'
import { Sidebar } from './Sidebar'
import type { ConnectionState } from '@/core/mqtt/types'

interface AppLayoutProps {
  children: ReactNode
  mqttStatus: ConnectionState
  activePage: string
  onNavigate: (page: string) => void
  onAddDevice: () => void
  deviceCount: number
  onlineCount: number
}

export function AppLayout({
  children,
  mqttStatus,
  activePage,
  onNavigate,
  onAddDevice,
  deviceCount,
  onlineCount,
}: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activePage={activePage}
        onNavigate={onNavigate}
        deviceCount={deviceCount}
        onlineCount={onlineCount}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          mqttStatus={mqttStatus}
          onAddDevice={onAddDevice}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        />

        <main className="flex-1 overflow-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
