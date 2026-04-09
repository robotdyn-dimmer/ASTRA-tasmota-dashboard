import { Wifi, WifiOff, Plus, Menu, Sun, Moon, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { useSettingsStore } from '@/features/settings/store/settings-store'
import { useInstallPrompt } from '@/core/pwa/useInstallPrompt'
import type { ConnectionState } from '@/core/mqtt/types'

interface HeaderProps {
  mqttStatus: ConnectionState
  onAddDevice: () => void
  onToggleSidebar: () => void
}

const statusConfig: Record<ConnectionState, { label: string; Icon: typeof Wifi; className: string }> = {
  connected: { label: 'MQTT Connected', Icon: Wifi, className: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400' },
  connecting: { label: 'Connecting...', Icon: Wifi, className: 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400' },
  disconnected: { label: 'Disconnected', Icon: WifiOff, className: 'bg-muted border-border text-muted-foreground' },
  error: { label: 'MQTT Error', Icon: WifiOff, className: 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400' },
}

export function Header({ mqttStatus, onAddDevice, onToggleSidebar }: HeaderProps) {
  const { theme, setTheme } = useSettingsStore()
  const { canInstall, install } = useInstallPrompt()
  const status = statusConfig[mqttStatus]

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.classList.toggle('dark', next === 'dark')
  }

  return (
    <header className="h-[var(--spacing-header)] bg-card border-b border-border/60 flex items-center justify-between px-4 shrink-0 gap-3 shadow-sm">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={onToggleSidebar} className="lg:hidden shrink-0">
          <Menu size={20} />
        </Button>
        <div className="whitespace-nowrap">
          <h1 className="text-base font-semibold tracking-tight leading-tight">ASTRA</h1>
          <p className="text-[10px] text-muted-foreground/60 leading-none -mt-0.5">Tasmota dashboard</p>
        </div>
      </div>

      <div className="flex items-center gap-2 ml-auto">
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className={`gap-1.5 hidden sm:flex cursor-default ${status.className}`}>
              <status.Icon size={12} />
              <span className="text-xs">{status.label}</span>
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-64 text-xs">
            {mqttStatus === 'connected'
              ? 'MQTT provides instant updates. Devices push state changes in real-time.'
              : 'Without MQTT, devices are polled via HTTP every 30s. Configure a broker in Settings for instant updates.'}
          </TooltipContent>
        </Tooltip>

        {canInstall && (
          <Button variant="ghost" size="icon" onClick={install} title="Install app">
            <Download size={18} />
          </Button>
        )}

        <Button variant="ghost" size="icon" onClick={toggleTheme} title="Toggle theme">
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </Button>

        <Button size="sm" onClick={onAddDevice} className="gap-1.5 shrink-0">
          <Plus size={15} />
          <span className="hidden sm:inline">Add Device</span>
        </Button>
      </div>
    </header>
  )
}
