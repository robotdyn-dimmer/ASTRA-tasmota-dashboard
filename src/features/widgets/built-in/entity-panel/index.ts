import { lazy } from 'react'
import { widgetRegistry } from '@/features/widgets/registry/widget-registry'

widgetRegistry.register({
  type:        'entity-panel',
  name:        'Entity Panel',
  description: 'Group relays, sensors, and energy readings from any devices into one card',
  icon:        'LayoutGrid',
  defaultSize: { w: 3, h: 4 },
  minSize:     { w: 2, h: 2 },
  configSchema: {
    // Empty — this widget uses configComponent for its config dialog
    type: 'object',
    properties: {},
  },
  component:        lazy(() => import('./EntityPanelWidget')),
  configComponent:  lazy(() => import('./EntityPanelConfigDialog')),
})
