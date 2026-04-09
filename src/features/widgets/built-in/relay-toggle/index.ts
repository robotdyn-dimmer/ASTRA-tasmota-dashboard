import { lazy } from 'react'
import { widgetRegistry } from '@/features/widgets/registry/widget-registry'

widgetRegistry.register({
  type: 'relay-toggle',
  name: 'Relay Toggle',
  description: 'Toggle power relays on/off',
  icon: 'Power',
  defaultSize: { w: 3, h: 2 },
  minSize: { w: 2, h: 2 },
  configSchema: {
    type: 'object',
    properties: {
      showLabel:      { type: 'boolean', title: 'Show relay labels', default: true },
      showStatus:     { type: 'boolean', title: 'Show online status badge', default: true },
      confirmToggle:  { type: 'boolean', title: 'Require confirmation before toggle', default: false },
      compactLayout:  { type: 'boolean', title: 'Compact layout (icon only)', default: false },
    },
  },
  component: lazy(() => import('./RelayToggleWidget')),
})
