import { LayoutDashboard, Settings, MonitorSmartphone, X } from 'lucide-react'
import { cn } from '@/shared/utils/cn'

interface SidebarProps {
  open: boolean
  onClose: () => void
  activePage: string
  onNavigate: (page: string) => void
  deviceCount: number
  onlineCount: number
}

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'devices', label: 'Devices', icon: MonitorSmartphone },
  { id: 'settings', label: 'Settings', icon: Settings },
]

export function Sidebar({ open, onClose, activePage, onNavigate, deviceCount, onlineCount }: SidebarProps) {
  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          'fixed lg:static inset-y-0 left-0 z-50 w-[var(--spacing-sidebar)] bg-surface border-r border-border flex flex-col transition-transform duration-200',
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Mobile close button */}
        <div className="flex items-center justify-between p-4 lg:hidden">
          <span className="text-sm font-medium text-text-muted">Menu</span>
          <button onClick={onClose} className="p-1 rounded hover:bg-surface-hover text-text-muted">
            <X size={18} />
          </button>
        </div>

        {/* Device stats */}
        <div className="px-4 py-3 border-b border-border">
          <div className="flex items-center justify-between text-sm">
            <span className="text-text-muted">Devices</span>
            <span className="text-text">
              <span className="text-success font-medium">{onlineCount}</span>
              <span className="text-text-dim"> / {deviceCount}</span>
            </span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-2 space-y-1">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => {
                onNavigate(id)
                onClose()
              }}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                activePage === id
                  ? 'bg-primary/15 text-primary'
                  : 'text-text-muted hover:bg-surface-hover hover:text-text'
              )}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-border">
          <p className="text-xs text-text-dim">ASTRA v0.1.0</p>
        </div>
      </aside>
    </>
  )
}
