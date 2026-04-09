import { Cpu, Wifi, Clock, HardDrive, Network } from 'lucide-react'
import type { WidgetProps } from '@/features/widgets/registry/widget-types'
import { DeviceStatusBadge } from '@/features/devices/components/DeviceStatusBadge'

interface DeviceInfoConfig {
  showFirmware?: boolean
  showIp?:       boolean
  showRssi?:     boolean
  showUptime?:   boolean
  showMac?:      boolean
  showTopic?:    boolean
}

export default function DeviceInfoWidget({ devices, deviceStates, config }: WidgetProps) {
  if (devices.length === 0) {
    return <div className="text-muted-foreground text-sm p-4">No device selected</div>
  }

  const device = devices[0]
  const state  = deviceStates[0]
  const cfg    = config.settings as DeviceInfoConfig

  const showFirmware = cfg.showFirmware ?? true
  const showIp       = cfg.showIp       ?? true
  const showRssi     = cfg.showRssi     ?? true
  const showUptime   = cfg.showUptime   ?? true
  const showMac      = cfg.showMac      ?? false
  const showTopic    = cfg.showTopic    ?? true

  const infoItems = [
    showFirmware && { icon: HardDrive, label: 'Firmware', value: device.firmwareVersion || 'Unknown' },
    showIp       && { icon: Wifi,      label: 'IP',       value: device.ipAddress       || 'N/A' },
    showRssi     && { icon: Wifi,      label: 'RSSI',     value: state?.wifi ? `${state.wifi.rssi}%` : 'N/A' },
    showUptime   && { icon: Clock,     label: 'Uptime',   value: state?.uptime          || 'N/A' },
    showMac      && { icon: Network,   label: 'MAC',      value: device.macAddress      || 'N/A' },
  ].filter(Boolean) as Array<{ icon: typeof Cpu; label: string; value: string }>

  return (
    <div className="h-full flex flex-col p-3">
      <div className="flex items-center gap-2 mb-3">
        <DeviceStatusBadge online={state?.online ?? false} />
        <h4 className="text-sm font-medium truncate">{device.friendlyName}</h4>
      </div>

      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2 text-xs">
          <Cpu size={14} className="text-muted-foreground/70 shrink-0" />
          <span className="text-muted-foreground">Module</span>
          <span className="font-medium ml-auto truncate max-w-[60%] font-mono">{device.module || 'Unknown'}</span>
        </div>
        {infoItems.map(({ icon: Icon, label, value }) => (
          <div key={label} className="flex items-center gap-2 text-xs">
            <Icon size={14} className="text-muted-foreground/70 shrink-0" />
            <span className="text-muted-foreground">{label}</span>
            <span className="font-medium ml-auto truncate max-w-[60%] font-mono">{value}</span>
          </div>
        ))}
      </div>

      {showTopic && (
        <div className="mt-2 pt-2 border-t border-border text-[10px] text-muted-foreground/70 font-mono truncate">
          {device.mqttTopic}
        </div>
      )}
    </div>
  )
}
