import { cn } from '@/lib/utils'

interface DeviceStatusBadgeProps {
  online: boolean
  className?: string
}

export function DeviceStatusBadge({ online, className }: DeviceStatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full',
        online
          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
          : 'bg-muted text-muted-foreground/60',
        className
      )}
    >
      <span className={cn(
        'w-1.5 h-1.5 rounded-full',
        online ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.4)]' : 'bg-muted-foreground/30'
      )} />
      {online ? 'Online' : 'Offline'}
    </span>
  )
}
