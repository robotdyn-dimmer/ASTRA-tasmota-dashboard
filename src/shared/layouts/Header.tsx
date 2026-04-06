import { Wifi, WifiOff, Plus, Menu } from 'lucide-react'
import type { ConnectionState } from '@/core/mqtt/types'
import { cn } from '@/shared/utils/cn'

interface HeaderProps {
  mqttStatus: ConnectionState
  onAddDevice: () => void
  onToggleSidebar: () => void
}

const statusConfig: Record<ConnectionState, { color: string; label: string; Icon: typeof Wifi }> = {
  connected: { color: 'bg-success', label: 'MQTT Connected', Icon: Wifi },
  connecting: { color: 'bg-warning animate-pulse', label: 'Connecting...', Icon: Wifi },
  disconnected: { color: 'bg-danger', label: 'Disconnected', Icon: WifiOff },
  error: { color: 'bg-danger', label: 'MQTT Error', Icon: WifiOff },
}

export function Header({ mqttStatus, onAddDevice, onToggleSidebar }: HeaderProps) {
  const status = statusConfig[mqttStatus]

  return (
    <header className="h-[var(--spacing-header)] bg-surface border-b border-border flex items-center justify-between px-4 shrink-0">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="p-2 rounded-md hover:bg-surface-hover text-text-muted hover:text-text transition-colors lg:hidden"
        >
          <Menu size={20} />
        </button>
        <h1 className="text-lg font-semibold text-text tracking-tight">
          TASMOTA<span className="text-primary">Admin</span>
        </h1>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-sm text-text-muted">
          <div className={cn('w-2 h-2 rounded-full', status.color)} />
          <status.Icon size={16} />
          <span className="hidden sm:inline">{status.label}</span>
        </div>

        <button
          onClick={onAddDevice}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary-hover text-primary-foreground text-sm font-medium rounded-md transition-colors"
        >
          <Plus size={16} />
          <span className="hidden sm:inline">Add Device</span>
        </button>
      </div>
    </header>
  )
}
