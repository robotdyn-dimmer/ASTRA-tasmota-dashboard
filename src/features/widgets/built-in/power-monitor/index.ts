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
      showChart:   { type: 'boolean', title: 'Show live chart', default: true },
      chartMetric: { type: 'string',  title: 'Chart metric (power / voltage / current)', default: 'power' },
      showTotals:  { type: 'boolean', title: 'Show today / total kWh', default: true },
      maxPoints:   { type: 'number',  title: 'Chart history points', default: 60 },
    },
  },
  component: lazy(() => import('./PowerMonitorWidget')),
})
