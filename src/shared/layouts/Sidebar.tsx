import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Settings, MonitorSmartphone, Info, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

interface SidebarProps {
  open: boolean
  onClose: () => void
  deviceCount: number
  onlineCount: number
}

const navItems = [
  { to: '/',         label: 'Dashboard',   icon: LayoutDashboard,   end: true },
  { to: '/devices',  label: 'Devices',     icon: MonitorSmartphone, end: false },
  { to: '/settings', label: 'Settings',    icon: Settings,          end: false },
  { to: '/about',    label: 'About',       icon: Info,              end: false },
]

export function Sidebar({ open, onClose, deviceCount, onlineCount }: SidebarProps) {
  return (
    <>
      {open && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={onClose} />
      )}

      <aside className={cn(
        'fixed lg:static inset-y-0 left-0 z-50 w-[var(--spacing-sidebar)] bg-card border-r border-border flex flex-col transition-transform duration-200',
        open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      )}>
        {/* Mobile close */}
        <div className="flex items-center justify-between p-3 lg:hidden">
          <span className="text-sm font-medium text-muted-foreground">Menu</span>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X size={18} />
          </Button>
        </div>

        {/* Device stats */}
        <div className="px-4 py-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Devices</span>
            <div className="flex items-center gap-1.5">
              <Badge variant="outline" className="border-green-500/40 text-green-600 dark:text-green-400 text-xs px-1.5 py-0">
                {onlineCount} online
              </Badge>
              <span className="text-muted-foreground text-xs">/ {deviceCount}</span>
            </div>
          </div>
        </div>
        <Separator />

        {/* Navigation */}
        <nav className="flex-1 p-2 space-y-0.5 mt-1">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={onClose}
              className={({ isActive }) => cn(
                'flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                isActive
                  ? 'bg-primary/10 text-primary shadow-sm'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <Icon size={18} className={cn('shrink-0')} />
              {label}
            </NavLink>
          ))}
        </nav>

        <Separator />
        <div className="p-4 space-y-1">
          <p className="text-xs text-muted-foreground">ASTRA v0.1.0-dev</p>
          <a
            href="https://www.rocketcontroller.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-muted-foreground/60 hover:text-primary transition-colors"
          >
            rocketcontroller.com
          </a>
        </div>
      </aside>
    </>
  )
}
