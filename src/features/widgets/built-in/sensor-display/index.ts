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
      sensorKey:     { type: 'string',  title: 'Filter by sensor key (e.g. AM2301)', default: '' },
      maxSensors:    { type: 'number',  title: 'Max sensors to show', default: 6 },
      decimalPlaces: { type: 'number',  title: 'Decimal places (0-2)', default: 1 },
      showUnits:     { type: 'boolean', title: 'Show unit labels', default: true },
      listLayout:    { type: 'boolean', title: 'List layout (instead of grid)', default: false },
    },
  },
  component: lazy(() => import('./SensorDisplayWidget')),
})
