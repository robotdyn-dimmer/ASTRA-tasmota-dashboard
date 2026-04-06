import { lazy } from 'react'
import { widgetRegistry } from '@/features/widgets/registry/widget-registry'

widgetRegistry.register({
  type: 'sensor-display',
  name: 'Sensor Display',
  description: 'Show sensor readings (temperature, humidity, etc.)',
  icon: 'Thermometer',
  defaultSize: { w: 3, h: 3 },
  minSize: { w: 2, h: 2 },
  configSchema: {
    type: 'object',
    properties: {
      sensorKey: { type: 'string', title: 'Filter by sensor key', default: '' },
    },
  },
  component: lazy(() => import('./SensorDisplayWidget')),
})
