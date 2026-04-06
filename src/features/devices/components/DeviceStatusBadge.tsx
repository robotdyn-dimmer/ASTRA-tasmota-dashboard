import { cn } from '@/shared/utils/cn'

interface DeviceStatusBadgeProps {
  online: boolean
  className?: string
}

export function DeviceStatusBadge({ online, className }: DeviceStatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium',
        online
          ? 'bg-success/15 text-success'
          : 'bg-danger/15 text-danger',
        className
      )}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full', online ? 'bg-success' : 'bg-danger')} />
      {online ? 'Online' : 'Offline'}
    </span>
  )
}
