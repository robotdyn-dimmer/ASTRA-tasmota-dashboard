import { useState, useCallback, useEffect, useRef } from 'react'
import { ResponsiveGridLayout } from 'react-grid-layout'
import { useRoleStore } from '@/core/auth/role-store'
import { Plus, Pencil, Check, LayoutDashboard, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useDashboardStore } from '@/features/dashboard/store/dashboard-store'
import { useDeviceStore } from '@/features/devices/store/device-store'
import { widgetRegistry } from '@/features/widgets/registry/widget-registry'
import { WidgetSlot } from './WidgetSlot'
import { APP_DEFAULTS } from '@/core/config/constants'
import { cn } from '@/lib/utils'
import type { WidgetConfig } from '@/features/widgets/registry/widget-types'

import 'react-grid-layout/css/styles.css'

// RGL v2 types are stricter than runtime allows — cast once here
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Grid = ResponsiveGridLayout as any

export function DashboardPage() {
  const {
    dashboards, activeDashboardId, editMode,
    setEditMode, setActiveDashboard, createDashboard, deleteDashboard,
    addWidget, removeWidget, updateLayout,
  } = useDashboardStore()

  const devices  = useDeviceStore((s) => s.devices)
  const isAdmin  = useRoleStore(s => s.isAdmin())
  const [showWidgetPicker, setShowWidgetPicker] = useState(false)
  const [showNewDash, setShowNewDash] = useState(false)
  const [newDashName, setNewDashName] = useState('')
  const [autoConfigWidgetId, setAutoConfigWidgetId] = useState<string | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const [gridWidth, setGridWidth] = useState(1200)
  useEffect(() => {
    const el = gridRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => setGridWidth(entries[0].contentRect.width))
    ro.observe(el)
    setGridWidth(el.offsetWidth)
    return () => ro.disconnect()
  }, [])

  const dashboard = dashboards.find(d => d.id === activeDashboardId)

  // Save layout only on explicit drag/resize — not on breakpoint/resize init events.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const saveLayout = useCallback((layout: any[]) => {
    if (!editMode || !dashboard) return
    updateLayout(dashboard.id, layout.map((l: { i: string; x: number; y: number; w: number; h: number }) => ({ instanceId: l.i, x: l.x, y: l.y, w: l.w, h: l.h })))
  }, [editMode, dashboard, updateLayout])

  // onLayoutChange is used ONLY to catch drag/resize that onDragStop/onResizeStop miss.
  // We guard against mount-time init calls using a ref that's set after the first
  // ResizeObserver cycle has settled (500ms covers both child and parent effects).
  const canSaveRef = useRef(false)
  useEffect(() => {
    const t = setTimeout(() => { canSaveRef.current = true }, 500)
    return () => clearTimeout(t)
  }, [])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleLayoutChange = useCallback((layout: any[]) => {
    if (!canSaveRef.current) return
    if (!editMode || !dashboard) return
    // Only persist if positions actually changed — prevents the RGL re-render loop:
    // updateLayout → new state → new layouts prop → RGL fires onLayoutChange → repeat
    const changed = layout.some((l: { i: string; x: number; y: number; w: number; h: number }) => {
      const w = dashboard.widgets.find(w => w.instanceId === l.i)
      return !w || w.layout.x !== l.x || w.layout.y !== l.y || w.layout.w !== l.w || w.layout.h !== l.h
    })
    if (!changed) return
    updateLayout(dashboard.id, layout.map((l: { i: string; x: number; y: number; w: number; h: number }) => ({ instanceId: l.i, x: l.x, y: l.y, w: l.w, h: l.h })))
  }, [editMode, dashboard, updateLayout])

  // Auto-create default dashboard if none exists
  if (dashboards.length === 0) {
    createDashboard('Main Dashboard')
    return null
  }

  if (!dashboard) return null

  // Provide the same layout for every breakpoint so RGL always has positions to work with.
  // Without this, RGL falls back to an auto-derived layout that often positions everything at (0,0).
  const layoutItems = dashboard.widgets.map(w => ({
    i: w.instanceId,
    x: w.layout.x, y: w.layout.y, w: w.layout.w, h: w.layout.h,
    minW: widgetRegistry.get(w.config.widgetType)?.minSize?.w ?? 1,
    minH: widgetRegistry.get(w.config.widgetType)?.minSize?.h ?? 1,
  }))
  const layouts = { lg: layoutItems, md: layoutItems, sm: layoutItems, xs: layoutItems, xxs: layoutItems }

  const handleAddWidget = (widgetType: string) => {
    const def = widgetRegistry.get(widgetType)
    if (!def) return
    const config: WidgetConfig = {
      widgetType,
      deviceIds: Object.keys(devices).slice(0, 1),
      settings:  {},
    }
    // Place new widget: try to fit in the last row, otherwise start a new row.
    const COLS = APP_DEFAULTS.GRID_COLS.lg
    const nw = def.defaultSize.w
    const nh = def.defaultSize.h
    let placeX = 0, placeY = 0
    if (dashboard.widgets.length > 0) {
      const maxY = Math.max(...dashboard.widgets.map(w => w.layout.y + w.layout.h))
      // Find widgets on the bottom row
      const bottomRowY = Math.max(...dashboard.widgets.map(w => w.layout.y))
      const bottomWidgets = dashboard.widgets.filter(w => w.layout.y === bottomRowY)
      const rightEdge = bottomWidgets.reduce((max, w) => Math.max(max, w.layout.x + w.layout.w), 0)
      if (rightEdge + nw <= COLS) {
        placeX = rightEdge
        placeY = bottomRowY
      } else {
        placeX = 0
        placeY = maxY
      }
    }
    const instanceId = `widget_${Date.now()}`
    addWidget(dashboard.id, {
      instanceId,
      config,
      layout: { x: placeX, y: placeY, w: nw, h: nh },
    })
    setShowWidgetPicker(false)
    // Auto-open config dialog for the newly added widget
    setAutoConfigWidgetId(instanceId)
  }

  const handleCreateDashboard = () => {
    if (!newDashName.trim()) return
    createDashboard(newDashName.trim())
    setNewDashName('')
    setShowNewDash(false)
  }

  return (
    <div className="space-y-4">

      {/* ── Dashboard tabs row ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1 flex-wrap flex-1">
          {dashboards.map(dash => (
            <div key={dash.id} className="relative group/tab">
              <button
                onClick={() => setActiveDashboard(dash.id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                  dash.id === activeDashboardId
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <LayoutDashboard size={13} />
                {dash.name}
              </button>
              {/* Delete tab button — only in edit mode, only when >1 dashboard */}
              {editMode && dashboards.length > 1 && dash.id === activeDashboardId && (
                <button
                  onClick={() => deleteDashboard(dash.id)}
                  className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover/tab:opacity-100 transition-opacity"
                  title="Delete dashboard"
                >
                  <X size={10} />
                </button>
              )}
            </div>
          ))}

          {/* New dashboard button */}
          {showNewDash ? (
            <div className="flex items-center gap-1">
              <Input
                value={newDashName}
                onChange={e => setNewDashName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleCreateDashboard(); if (e.key === 'Escape') setShowNewDash(false) }}
                placeholder="Dashboard name"
                className="h-7 text-sm w-36"
                autoFocus
              />
              <Button size="sm" variant="ghost" className="h-7 px-2" onClick={handleCreateDashboard}>
                <Check size={13} />
              </Button>
              <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setShowNewDash(false)}>
                <X size={13} />
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-muted-foreground"
              onClick={() => setShowNewDash(true)}
              title="Add dashboard"
            >
              <Plus size={14} />
            </Button>
          )}
        </div>

        {/* Edit mode controls — admin only */}
        {isAdmin && (
          <div className="flex items-center gap-2 shrink-0">
            {editMode && (
              <Button size="sm" variant="secondary" onClick={() => setShowWidgetPicker(true)} className="gap-1.5">
                <Plus size={15} /> Add Widget
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => setEditMode(!editMode)} className="gap-1.5">
              {editMode ? <Check size={15} /> : <Pencil size={15} />}
              {editMode ? 'Done' : 'Edit'}
            </Button>
          </div>
        )}
      </div>

      {/* ── Grid ── */}
      <div ref={gridRef}>
      {dashboard.widgets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <p className="text-lg font-medium mb-2">Dashboard is empty</p>
          <p className="text-sm mb-4">Click "Edit" then "Add Widget" to get started</p>
        </div>
      ) : (
        <Grid
          width={gridWidth}
          layouts={layouts}
          breakpoints={APP_DEFAULTS.GRID_BREAKPOINTS}
          cols={APP_DEFAULTS.GRID_COLS}
          rowHeight={APP_DEFAULTS.GRID_ROW_HEIGHT}
          isDraggable={editMode}
          isResizable={editMode}
          draggableHandle=".drag-handle"
          onDragStop={saveLayout}
          onResizeStop={saveLayout}
          onLayoutChange={handleLayoutChange}
          compactType="vertical"
          preventCollision={false}
          margin={[12, 12]}
        >
          {dashboard.widgets.map((widget) => (
            <div key={widget.instanceId}>
              <WidgetSlot
                widget={widget}
                dashboardId={dashboard.id}
                isEditing={editMode}
                onRemove={() => removeWidget(dashboard.id, widget.instanceId)}
                autoOpenConfig={widget.instanceId === autoConfigWidgetId}
                onConfigOpened={() => { if (widget.instanceId === autoConfigWidgetId) setAutoConfigWidgetId(null) }}
              />
            </div>
          ))}
        </Grid>
      )}
      </div>

      {/* ── Widget picker modal ── */}
      {showWidgetPicker && (
        <WidgetPicker onSelect={handleAddWidget} onClose={() => setShowWidgetPicker(false)} />
      )}
    </div>
  )
}

function WidgetPicker({ onSelect, onClose }: { onSelect: (type: string) => void; onClose: () => void }) {
  const allWidgets = widgetRegistry.getAll()
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-xl p-6 w-full max-w-lg shadow-xl">
        <h3 className="text-lg font-semibold mb-4">Add Widget</h3>
        <div className="grid grid-cols-2 gap-3">
          {allWidgets.map((def) => (
            <button
              key={def.type}
              onClick={() => onSelect(def.type)}
              className="text-left p-4 bg-muted rounded-lg border border-border hover:border-primary/40 transition-colors"
            >
              <p className="text-sm font-medium">{def.name}</p>
              <p className="text-xs text-muted-foreground mt-1">{def.description}</p>
            </button>
          ))}
        </div>
        <Button variant="outline" className="mt-4 w-full" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
