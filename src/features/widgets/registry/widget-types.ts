import type { ComponentType, LazyExoticComponent } from 'react'
import type { JSONSchema7 } from 'json-schema'
import type { TasmotaDevice, DeviceState } from '@/features/devices/store/device-store.types'

// ── Entity Panel types ────────────────────────────────────────────────────────

export type PanelEntityType = 'relay' | 'sensor' | 'energy' | 'pwm' | 'counter' | 'button' | 'switch_input' | 'adc' | 'led'

/**
 * A single entity within an Entity Panel widget.
 * Uses mqttTopic (NOT deviceId) as the stable cross-browser identifier.
 * When a user opens ASTRA on a different browser, the same Tasmota device
 * may have a different deviceId, but mqttTopic is always the same.
 */
export interface PanelEntity {
  id:         string           // crypto.randomUUID() — React list key only
  mqttTopic:  string           // stable Tasmota topic (e.g. "tasmota_bedroom")
  entityType: PanelEntityType
  entityKey:  string           // "POWER1" | "AM2301.Temperature" | "ENERGY.Power"
  label?:     string           // optional custom display name
}

export interface EntityPanelSettings {
  panelTitle?: string
  entities:    PanelEntity[]
  compact:     boolean
}

// ── Custom config dialog types ────────────────────────────────────────────────

/** Props received by a widget's custom configComponent */
export interface CustomConfigProps {
  open:        boolean
  instanceId:  string
  dashboardId: string
  settings:    Record<string, unknown>
  deviceIds:   string[]
  onSave:      (settings: Record<string, unknown>, deviceIds?: string[]) => void
  onClose:     () => void
}

// ── Core widget types ─────────────────────────────────────────────────────────

export interface WidgetDefinition {
  type:        string
  name:        string
  description: string
  icon:        string
  defaultSize: { w: number; h: number }
  minSize?:    { w: number; h: number }
  configSchema: JSONSchema7
  component:   LazyExoticComponent<ComponentType<WidgetProps>>
  /** Optional custom config dialog — replaces generic WidgetConfigDialog for this widget type */
  configComponent?: LazyExoticComponent<ComponentType<CustomConfigProps>>
}

export interface WidgetConfig {
  widgetType: string
  deviceIds:  string[]
  settings:   Record<string, unknown>
}

export interface WidgetProps {
  config:       WidgetConfig
  devices:      TasmotaDevice[]
  deviceStates: DeviceState[]
  onCommand:    (deviceId: string, command: string) => void
  isEditing:    boolean
}

export interface DashboardLayout {
  id:      string
  name:    string
  widgets: WidgetInstance[]
}

export interface WidgetInstance {
  instanceId: string
  config:     WidgetConfig
  layout:     { x: number; y: number; w: number; h: number }
}
