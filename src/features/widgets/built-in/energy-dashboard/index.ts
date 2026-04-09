import { lazy } from 'react'
import { widgetRegistry } from '@/features/widgets/registry/widget-registry'

widgetRegistry.register({
  type:        'energy-dashboard',
  name:        'Energy Dashboard',
  description: 'Power consumption with history chart and cost estimate',
  icon:        'PlugZap',
  defaultSize: { w: 4, h: 5 },
  minSize:     { w: 3, h: 4 },
  configSchema: {
    type: 'object',
    properties: {
      timeRange: {
        type:    'string',
        title:   'Default time range (1h / 6h / 24h / 7d)',
        default: '6h',
      },
      tariff: {
        type:        'number',
        title:       'Electricity tariff (per kWh, 0 = hide cost)',
        description: 'Set your electricity price per kWh to see cost estimates',
        default:     0,
      },
      currency: {
        type:    'string',
        title:   'Currency symbol',
        default: '₽',
      },
      showVoltage: {
        type:    'boolean',
        title:   'Show voltage',
        default: true,
      },
      showCurrent: {
        type:    'boolean',
        title:   'Show current (A)',
        default: true,
      },
    },
  },
  component: lazy(() => import('./EnergyDashboardWidget')),
})
