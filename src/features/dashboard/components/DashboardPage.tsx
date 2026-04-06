import { useState, useCallback } from 'react'
import { ResponsiveGridLayout } from 'react-grid-layout'
import { Plus, Pencil, Check } from 'lucide-react'
import { useDashboardStore } from '@/features/dashboard/store/dashboard-store'
import { useDeviceStore } from '@/features/devices/store/device-store'
import { widgetRegistry } from '@/features/widgets/registry/widget-registry'
import { WidgetSlot } from './WidgetSlot'
import { APP_DEFAULTS } from '@/core/config/constants'
import type { WidgetInstance, WidgetConfig } from '@/features/widgets/registry/widget-types'

import 'react-grid-layout/css/styles.css'

// ResponsiveGridLayout already includes width provider in v2

export function DashboardPage() {
  const { dashboards, activeDashboardId, editMode, setEditMode, addWidget, removeWidget, updateLayout, createDashboard } = useDashboardStore()
  const devices = useDeviceStore((s) => s.devices)
  const [showWidgetPicker, setShowWidgetPicker] = useState(false)

  const dashboard = dashboards.find(d => d.id === activeDashboardId)

  const handleLayoutChange = useCallback(
    (layout: Array<{ i: string; x: number; y: number; w: number; h: number }>) => {
      if (!editMode || !dashboard) return
      updateLayout(
        dashboard.id,
        layout.map(l => ({ instanceId: l.i, x: l.x, y: l.y, w: l.w, h: l.h }))
      )
    },
    [editMode, dashboard, updateLayout]
  )

  // Auto-create default dashboard if none exists
  if (dashboards.length === 0) {
    createDashboard('Main Dashboard')
    return null
  }

  if (!dashboard) return null

  const layouts = {
    lg: dashboard.widgets.map(w => ({
      i: w.instanceId,
      x: w.layout.x,
      y: w.layout.y,
      w: w.layout.w,
      h: w.layout.h,
      minW: widgetRegistry.get(w.config.widgetType)?.minSize?.w ?? 1,
      minH: widgetRegistry.get(w.config.widgetType)?.minSize?.h ?? 1,
    })),
  }

  const handleAddWidget = (widgetType: string) => {
    const def = widgetRegistry.get(widgetType)
    if (!def) return

    const deviceIds = Object.keys(devices).slice(0, 1)
    const config: WidgetConfig = {
      widgetType,
      deviceIds,
      settings: {},
    }

    const instance: WidgetInstance = {
      instanceId: `widget_${Date.now()}`,
      config,
      layout: { x: 0, y: Infinity, w: def.defaultSize.w, h: def.defaultSize.h },
    }

    addWidget(dashboard.id, instance)
    setShowWidgetPicker(false)
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-text">{dashboard.name}</h2>
        <div className="flex items-center gap-2">
          {editMode && (
            <button
              onClick={() => setShowWidgetPicker(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary text-secondary-foreground text-sm rounded-md hover:bg-secondary-hover transition-colors"
            >
              <Plus size={16} />
              Add Widget
            </button>
          )}
          <button
            onClick={() => setEditMode(!editMode)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-hover text-text-muted text-sm rounded-md hover:bg-border transition-colors"
          >
            {editMode ? <Check size={16} /> : <Pencil size={16} />}
            {editMode ? 'Done' : 'Edit'}
          </button>
        </div>
      </div>

      {/* Grid */}
      {dashboard.widgets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-text-muted">
          <p className="text-lg font-medium mb-2">Dashboard is empty</p>
          <p className="text-sm mb-4">Click "Edit" then "Add Widget" to get started</p>
        </div>
      ) : (
        <ResponsiveGridLayout
          layouts={layouts}
          breakpoints={APP_DEFAULTS.GRID_BREAKPOINTS}
          cols={APP_DEFAULTS.GRID_COLS}
          rowHeight={APP_DEFAULTS.GRID_ROW_HEIGHT}
          isDraggable={editMode}
          isResizable={editMode}
          draggableHandle=".drag-handle"
          onLayoutChange={handleLayoutChange}
          margin={[12, 12]}
        >
          {dashboard.widgets.map((widget) => (
            <div key={widget.instanceId}>
              <WidgetSlot
                widget={widget}
                isEditing={editMode}
                onRemove={() => removeWidget(dashboard.id, widget.instanceId)}
              />
            </div>
          ))}
        </ResponsiveGridLayout>
      )}

      {/* Widget picker modal */}
      {showWidgetPicker && (
        <WidgetPicker
          onSelect={handleAddWidget}
          onClose={() => setShowWidgetPicker(false)}
        />
      )}
    </div>
  )
}

function WidgetPicker({ onSelect, onClose }: { onSelect: (type: string) => void; onClose: () => void }) {
  const allWidgets = widgetRegistry.getAll()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-surface border border-border rounded-xl p-6 w-full max-w-lg shadow-xl">
        <h3 className="text-lg font-semibold text-text mb-4">Add Widget</h3>
        <div className="grid grid-cols-2 gap-3">
          {allWidgets.map((def) => (
            <button
              key={def.type}
              onClick={() => onSelect(def.type)}
              className="text-left p-4 bg-surface-hover rounded-lg border border-border hover:border-primary/40 transition-colors"
            >
              <p className="text-sm font-medium text-text">{def.name}</p>
              <p className="text-xs text-text-muted mt-1">{def.description}</p>
            </button>
          ))}
        </div>
        <button
          onClick={onClose}
          className="mt-4 w-full px-4 py-2 bg-surface-hover text-text-muted rounded-md text-sm hover:bg-border transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
