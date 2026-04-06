import type { ComponentType, LazyExoticComponent } from 'react'
import type { JSONSchema7 } from 'json-schema'
import type { TasmotaDevice, DeviceState } from '@/features/devices/store/device-store.types'

export interface WidgetDefinition {
  type: string
  name: string
  description: string
  icon: string
  defaultSize: { w: number; h: number }
  minSize?: { w: number; h: number }
  configSchema: JSONSchema7
  component: LazyExoticComponent<ComponentType<WidgetProps>>
}

export interface WidgetConfig {
  widgetType: string
  deviceIds: string[]
  settings: Record<string, unknown>
}

export interface WidgetProps {
  config: WidgetConfig
  devices: TasmotaDevice[]
  deviceStates: DeviceState[]
  onCommand: (deviceId: string, command: string) => void
  isEditing: boolean
}

export interface DashboardLayout {
  id: string
  name: string
  widgets: WidgetInstance[]
}

export interface WidgetInstance {
  instanceId: string
  config: WidgetConfig
  layout: { x: number; y: number; w: number; h: number }
}
