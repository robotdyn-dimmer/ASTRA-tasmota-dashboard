import { Suspense, Component, type ReactNode } from 'react'
import { X, GripVertical } from 'lucide-react'
import { useDeviceStore } from '@/features/devices/store/device-store'
import { widgetRegistry } from '@/features/widgets/registry/widget-registry'
import { mqttClient } from '@/core/mqtt/MqttClient'
import { buildCommandTopic } from '@/lib/tasmota-topic-utils'
import type { WidgetInstance } from '@/features/widgets/registry/widget-types'
import { cn } from '@/shared/utils/cn'

interface WidgetSlotProps {
  widget: WidgetInstance
  isEditing: boolean
  onRemove: () => void
}

export function WidgetSlot({ widget, isEditing, onRemove }: WidgetSlotProps) {
  const definition = widgetRegistry.get(widget.config.widgetType)
  if (!definition) {
    return (
      <div className="h-full bg-card border border-danger/30 rounded-lg p-3 text-danger text-sm">
        Unknown widget: {widget.config.widgetType}
      </div>
    )
  }

  const WidgetComponent = definition.component

  return (
    <div className={cn('h-full bg-card border border-border rounded-lg overflow-hidden relative group', isEditing && 'border-dashed border-primary/40')}>
      {isEditing && (
        <div className="absolute top-1 right-1 z-10 flex gap-1">
          <div className="drag-handle cursor-grab active:cursor-grabbing p-1 rounded bg-surface-hover/80 text-text-dim hover:text-text">
            <GripVertical size={14} />
          </div>
          <button
            onClick={onRemove}
            className="p-1 rounded bg-surface-hover/80 text-text-dim hover:text-danger"
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
  )
}

function WidgetDataBridge({
  widget,
  isEditing,
  children,
}: {
  widget: WidgetInstance
  isEditing: boolean
  children: (props: any) => ReactNode
}) {
  const allDevices = useDeviceStore((s) => s.devices)
  const allStates = useDeviceStore((s) => s.deviceStates)

  const devices = widget.config.deviceIds
    .map(id => allDevices[id])
    .filter(Boolean)

  const deviceStates = widget.config.deviceIds
    .map(id => allStates[id])
    .filter(Boolean)

  const onCommand = (deviceId: string, command: string) => {
    const device = allDevices[deviceId]
    if (!device) return
    const [cmd, ...args] = command.split(' ')
    mqttClient.publish(buildCommandTopic(device.mqttTopic, cmd), args.join(' ') || '')
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
        <div className="h-full flex items-center justify-center p-3 text-danger text-sm">
          Widget error: {this.state.error.message}
        </div>
      )
    }
    return this.props.children
  }
}
