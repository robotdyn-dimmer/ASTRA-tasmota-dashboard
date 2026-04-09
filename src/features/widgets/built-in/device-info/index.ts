import { lazy } from 'react'
import { widgetRegistry } from '@/features/widgets/registry/widget-registry'

widgetRegistry.register({
  type: 'device-info',
  name: 'Device Info',
  description: 'Show device information (IP, firmware, uptime)',
  icon: 'Info',
  defaultSize: { w: 3, h: 3 },
  minSize: { w: 2, h: 2 },
  configSchema: {
    type: 'object',
    properties: {
      showFirmware: { type: 'boolean', title: 'Show firmware version', default: true },
      showIp:       { type: 'boolean', title: 'Show IP address', default: true },
      showRssi:     { type: 'boolean', title: 'Show WiFi signal strength', default: true },
      showUptime:   { type: 'boolean', title: 'Show uptime', default: true },
      showMac:      { type: 'boolean', title: 'Show MAC address', default: false },
      showTopic:    { type: 'boolean', title: 'Show MQTT topic', default: true },
    },
  },
  component: lazy(() => import('./DeviceInfoWidget')),
})
