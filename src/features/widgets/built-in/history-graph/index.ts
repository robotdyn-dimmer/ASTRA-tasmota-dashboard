import { lazy } from 'react'
import { widgetRegistry } from '@/features/widgets/registry/widget-registry'

widgetRegistry.register({
  type:        'history-graph',
  name:        'History Graph',
  description: 'Time-series chart of sensor readings from local history',
  icon:        'TrendingUp',
  defaultSize: { w: 6, h: 4 },
  minSize:     { w: 4, h: 3 },
  configSchema: {
    type: 'object',
    properties: {
      sensorKeys: {
        type:        'array',
        title:       'Sensor keys',
        description: 'e.g. AM2301.Temperature, AM2301.Humidity, ENERGY.Power',
        items:       { type: 'string' },
      },
      timeRange: {
        type:    'string',
        title:   'Default time range',
        default: '6h',
      },
      chartType: {
        type:    'string',
        title:   'Chart type (line or area)',
        default: 'line',
      },
    },
  },
  component: lazy(() => import('./HistoryGraphWidget')),
})
