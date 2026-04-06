import { Cpu, Wifi, Clock, HardDrive } from 'lucide-react'
import type { WidgetProps } from '@/features/widgets/registry/widget-types'
import { DeviceStatusBadge } from '@/features/devices/components/DeviceStatusBadge'

export default function DeviceInfoWidget({ devices, deviceStates }: WidgetProps) {
  if (devices.length === 0) {
    return <div className="text-text-muted text-sm p-4">No device selected</div>
  }

  const device = devices[0]
  const state = deviceStates[0]

  const infoItems = [
    { icon: Cpu, label: 'Module', value: device.module || 'Unknown' },
    { icon: HardDrive, label: 'Firmware', value: device.firmwareVersion || 'Unknown' },
    { icon: Wifi, label: 'IP', value: device.ipAddress || 'N/A' },
    { icon: Wifi, label: 'RSSI', value: state?.wifi ? `${state.wifi.rssi}%` : 'N/A' },
    { icon: Clock, label: 'Uptime', value: state?.uptime || 'N/A' },
  ]

  return (
    <div className="h-full flex flex-col p-3">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-text truncate">{device.friendlyName}</h4>
        <DeviceStatusBadge online={state?.online ?? false} />
      </div>

      <div className="flex-1 space-y-2">
        {infoItems.map(({ icon: Icon, label, value }) => (
          <div key={label} className="flex items-center gap-2 text-xs">
            <Icon size={14} className="text-text-dim shrink-0" />
            <span className="text-text-muted">{label}</span>
            <span className="text-text font-medium ml-auto truncate max-w-[60%]">{value}</span>
          </div>
        ))}
      </div>

      <div className="mt-2 pt-2 border-t border-border text-[10px] text-text-dim">
        Topic: {device.mqttTopic}
      </div>
    </div>
  )
}
