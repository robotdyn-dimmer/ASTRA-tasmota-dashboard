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
    properties: {},
  },
  component: lazy(() => import('./DeviceInfoWidget')),
})
