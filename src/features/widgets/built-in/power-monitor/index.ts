import { lazy } from 'react'
import { widgetRegistry } from '@/features/widgets/registry/widget-registry'

widgetRegistry.register({
  type: 'power-monitor',
  name: 'Power Monitor',
  description: 'Monitor power consumption with live chart',
  icon: 'Zap',
  defaultSize: { w: 6, h: 4 },
  minSize: { w: 3, h: 3 },
  configSchema: {
    type: 'object',
    properties: {
      showChart: { type: 'boolean', title: 'Show chart', default: true },
    },
  },
  component: lazy(() => import('./PowerMonitorWidget')),
})
