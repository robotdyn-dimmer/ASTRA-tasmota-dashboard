import { Suspense, Component, useState, useEffect, type ReactNode } from 'react'
import { X, GripVertical, Settings2 } from 'lucide-react'
import { useDeviceStore } from '@/features/devices/store/device-store'
import { useDashboardStore } from '@/features/dashboard/store/dashboard-store'
import { widgetRegistry } from '@/features/widgets/registry/widget-registry'
import { mqttClient } from '@/core/mqtt/MqttClient'
import { tasmotaHttp } from '@/core/http/tasmota-http-client'
import { buildCommandTopic } from '@/lib/tasmota-topic-utils'
import { parsePowerState } from '@/shared/utils/tasmota-parsers'
import { WidgetConfigDialog } from './WidgetConfigDialog'
import type { WidgetInstance } from '@/features/widgets/registry/widget-types'
import { cn } from '@/lib/utils'

interface WidgetSlotProps {
  widget:         WidgetInstance
  dashboardId:    string
  isEditing:      boolean
  onRemove:       () => void
  autoOpenConfig?: boolean
  onConfigOpened?: () => void
}

export function WidgetSlot({ widget, dashboardId, isEditing, onRemove, autoOpenConfig, onConfigOpened }: WidgetSlotProps) {
  const [configOpen, setConfigOpen] = useState(false)

  // Auto-open config dialog for newly added widgets
  useEffect(() => {
    if (autoOpenConfig) {
      setConfigOpen(true)
      onConfigOpened?.()
    }
  }, [autoOpenConfig])
  const updateWidgetConfig = useDashboardStore(s => s.updateWidgetConfig)

  const definition = widgetRegistry.get(widget.config.widgetType)
  if (!definition) {
    return (
      <div className="h-full bg-card border border-destructive/30 rounded-lg p-3 text-destructive text-sm">
        Unknown widget: {widget.config.widgetType}
      </div>
    )
  }

  const WidgetComponent  = definition.component
  const CustomConfigComp = definition.configComponent

  // Show gear if widget has schema fields OR a custom config component
  const hasConfig = Object.keys(definition.configSchema.properties ?? {}).length > 0
                 || !!CustomConfigComp

  const handleSave = (settings: Record<string, unknown>, deviceIds?: string[]) => {
    updateWidgetConfig(dashboardId, widget.instanceId, settings, deviceIds)
  }

  return (
    <>
      <div className={cn(
        'h-full bg-card border border-border rounded-lg overflow-hidden relative group',
        isEditing && 'border-dashed border-primary/40'
      )}>
        {isEditing && (
          <div className="absolute top-1 right-1 z-10 flex gap-1">
            {hasConfig && (
              <button
                onClick={() => setConfigOpen(true)}
                className="p-1 rounded bg-muted/80 text-muted-foreground/70 hover:text-foreground"
                title="Configure widget"
              >
                <Settings2 size={14} />
              </button>
            )}
            <div className="drag-handle cursor-grab active:cursor-grabbing p-1 rounded bg-muted/80 text-muted-foreground/70 hover:text-foreground">
              <GripVertical size={14} />
            </div>
            <button
              onClick={onRemove}
              className="p-1 rounded bg-muted/80 text-muted-foreground/70 hover:text-destructive"
            >
              <X size={14} />
            </button>
          </div>
        )}

        <ErrorBoundary>
          <Suspense fallback={<WidgetLoading />}>
            <WidgetDataBridge widget={widget} isEditing={isEditing}>
              {(props) => <WidgetComponent {...props} />}
            </WidgetDataBridge>
          </Suspense>
        </ErrorBoundary>
      </div>

      {/* Config dialog — outside the card to avoid z-index issues */}
      {configOpen && (
        CustomConfigComp ? (
          // Widget defines its own config dialog (e.g. EntityPanel)
          <Suspense fallback={null}>
            <CustomConfigComp
              open={configOpen}
              instanceId={widget.instanceId}
              dashboardId={dashboardId}
              settings={widget.config.settings}
              deviceIds={widget.config.deviceIds}
              onSave={handleSave}
              onClose={() => setConfigOpen(false)}
            />
          </Suspense>
        ) : (
          // Generic schema-driven config dialog with device selector
          <WidgetConfigDialog
            open={configOpen}
            widgetType={widget.config.widgetType}
            instanceId={widget.instanceId}
            dashboardId={dashboardId}
            settings={widget.config.settings}
            deviceIds={widget.config.deviceIds}
            onSave={handleSave}
            onClose={() => setConfigOpen(false)}
          />
        )
      )}
    </>
  )
}

function WidgetDataBridge({
  widget,
  isEditing,
  children,
}: {
  widget:    WidgetInstance
  isEditing: boolean
  children:  (props: import('@/features/widgets/registry/widget-types').WidgetProps) => ReactNode
}) {
  const allDevices = useDeviceStore((s) => s.devices)
  const allStates  = useDeviceStore((s) => s.deviceStates)

  const devices      = widget.config.deviceIds.map(id => allDevices[id]).filter(Boolean)
  const deviceStates = widget.config.deviceIds.map(id => allStates[id]).filter(Boolean)

  const onCommand = (deviceId: string, command: string) => {
    const device = allDevices[deviceId]
    if (!device) return
    const [cmd, ...args] = command.split(' ')

    if (device.ipAddress) {
      // HTTP is the primary command channel — always reliable, updates store directly.
      // MQTT is secondary: also publish if connected (for devices that have MQTT broker
      // configured — they will process the command faster via MQTT).
      tasmotaHttp.sendCommand(device.ipAddress, command)
        .then(result => {
          if (result.ok) {
            const store = useDeviceStore.getState()
            const existing = store.deviceStates[deviceId]
            const patch: Partial<import('@/features/devices/store/device-store.types').DeviceState> = {
              online: true,
              lastSeen: Date.now(),
            }

            // Parse POWER state from response
            const newPower = parsePowerState(result.data)
            if (Object.keys(newPower).length > 0) {
              patch.power = { ...(existing?.power ?? {}), ...newPower }
            }

            // Parse LedPower state from response: { LedPower1: "ON" }
            const ledUpdates: Record<string, boolean> = {}
            for (const [k, v] of Object.entries(result.data)) {
              if (/^LedPower\d*$/i.test(k)) {
                const key = k.match(/\d/) ? k : k + '1'
                ledUpdates[key] = v === 'ON' || v === 1 || v === true
              }
            }
            if (Object.keys(ledUpdates).length > 0) {
              patch.leds = { ...(existing?.leds ?? {}), ...ledUpdates }
            }

            // Parse PWM state from response
            // Tasmota returns: { PWM: { PWM1: 512, PWM2: 0 } } (nested)
            // or possibly flat: { PWM1: 512 }
            const pwmUpdates: Record<string, number> = {}
            const pwmNested = result.data.PWM as Record<string, unknown> | undefined
            if (pwmNested && typeof pwmNested === 'object') {
              for (const [k, v] of Object.entries(pwmNested)) {
                if (/^PWM\d+$/i.test(k)) pwmUpdates[k.toUpperCase()] = Number(v)
              }
            }
            for (const [k, v] of Object.entries(result.data)) {
              if (/^PWM\d+$/i.test(k)) pwmUpdates[k.toUpperCase()] = Number(v)
            }
            if (Object.keys(pwmUpdates).length > 0) {
              patch.pwm = { ...(existing?.pwm ?? {}), ...pwmUpdates }
            }

            store.updateDeviceState(deviceId, patch)
          }
        })
        .catch(console.error)

      // Also publish via MQTT if connected (devices with MQTT broker will respond faster)
      if (mqttClient.connectionState === 'connected') {
        mqttClient.publish(buildCommandTopic(device.mqttTopic, cmd), args.join(' ') || '')
      }
    } else if (mqttClient.connectionState === 'connected') {
      // No IP — MQTT only path
      mqttClient.publish(buildCommandTopic(device.mqttTopic, cmd), args.join(' ') || '')
    }
  }

  return <>{children({ config: widget.config, devices, deviceStates, onCommand, isEditing })}</>
}

function WidgetLoading() {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) { return { error } }
  render() {
    if (this.state.error) {
      return (
        <div className="h-full flex items-center justify-center p-3 text-destructive text-sm">
          Widget error: {this.state.error.message}
        </div>
      )
    }
    return this.props.children
  }
}
