import { lazy } from 'react'
import { widgetRegistry } from '@/features/widgets/registry/widget-registry'

widgetRegistry.register({
  type:        'gauge',
  name:        'Gauge',
  description: 'Circular arc gauge for a single sensor value',
  icon:        'Gauge',
  defaultSize: { w: 2, h: 3 },
  minSize:     { w: 2, h: 2 },
  configSchema: {
    type: 'object',
    properties: {
      sensorKey: {
        type:        'string',
        title:       'Sensor key',
        description: 'e.g. AM2301.Temperature',
      },
      min: { type: 'number', title: 'Min value', default: 0 },
      max: { type: 'number', title: 'Max value', default: 100 },
      unit: { type: 'string', title: 'Unit label (auto-detected if empty)' },
    },
  },
  component: lazy(() => import('./GaugeWidget')),
})
