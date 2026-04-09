import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { DashboardLayout, WidgetInstance } from '@/features/widgets/registry/widget-types'
import type { DashboardSyncPayload } from '@/core/http/tasmota-http-client'

interface DashboardStoreState {
  dashboards:        DashboardLayout[]
  activeDashboardId: string | null
  editMode:          boolean
  savedAt:           number    // Unix ms of last mutation — used for sync conflict resolution

  getActiveDashboard:   () => DashboardLayout | undefined
  createDashboard:      (name: string) => string
  deleteDashboard:      (id: string) => void
  setActiveDashboard:   (id: string) => void
  setEditMode:          (editing: boolean) => void
  addWidget:            (dashboardId: string, widget: WidgetInstance) => void
  removeWidget:         (dashboardId: string, instanceId: string) => void
  updateWidgetConfig:   (dashboardId: string, instanceId: string, settings: Record<string, unknown>, deviceIds?: string[]) => void
  updateWidgetDeviceIds:(dashboardId: string, instanceId: string, deviceIds: string[]) => void
  updateLayout:         (dashboardId: string, layouts: Array<{ instanceId: string; x: number; y: number; w: number; h: number }>) => void
  mergeDashboardFromDevice: (payload: DashboardSyncPayload) => void
}

// Sync to device is handled centrally by config-sync.ts (watches all stores)

export const useDashboardStore = create<DashboardStoreState>()(
  persist(
    (set, get) => ({
      dashboards:        [],
      activeDashboardId: null,
      editMode:          false,
      savedAt:           0,

      getActiveDashboard: () => {
        const { dashboards, activeDashboardId } = get()
        return dashboards.find(d => d.id === activeDashboardId)
      },

      createDashboard: (name) => {
        const id = `dash_${Date.now()}`
        set((state) => ({
          dashboards:        [...state.dashboards, { id, name, widgets: [] }],
          activeDashboardId: state.activeDashboardId ?? id,
          savedAt:           Date.now(),
        }))
        return id
      },

      deleteDashboard: (id) => {
        set((state) => ({
          dashboards:        state.dashboards.filter(d => d.id !== id),
          activeDashboardId: state.activeDashboardId === id
            ? (state.dashboards.find(d => d.id !== id)?.id ?? null)
            : state.activeDashboardId,
          savedAt: Date.now(),
        }))
      },

      setActiveDashboard: (id) => set({ activeDashboardId: id, savedAt: Date.now() }),

      setEditMode: (editing) => set({ editMode: editing }),

      addWidget: (dashboardId, widget) => {
        set((state) => ({
          dashboards: state.dashboards.map(d =>
            d.id === dashboardId ? { ...d, widgets: [...d.widgets, widget] } : d
          ),
          savedAt: Date.now(),
        }))
      },

      updateWidgetConfig: (dashboardId, instanceId, settings, deviceIds) => {
        set((state) => ({
          dashboards: state.dashboards.map(d =>
            d.id !== dashboardId ? d : {
              ...d,
              widgets: d.widgets.map(w =>
                w.instanceId !== instanceId ? w : {
                  ...w,
                  config: {
                    ...w.config,
                    settings,
                    ...(deviceIds !== undefined ? { deviceIds } : {}),
                  },
                }
              ),
            }
          ),
          savedAt: Date.now(),
        }))
      },

      updateWidgetDeviceIds: (dashboardId, instanceId, deviceIds) => {
        set((state) => ({
          dashboards: state.dashboards.map(d =>
            d.id !== dashboardId ? d : {
              ...d,
              widgets: d.widgets.map(w =>
                w.instanceId !== instanceId ? w : { ...w, config: { ...w.config, deviceIds } }
              ),
            }
          ),
          savedAt: Date.now(),
        }))
      },

      removeWidget: (dashboardId, instanceId) => {
        set((state) => ({
          dashboards: state.dashboards.map(d =>
            d.id === dashboardId
              ? { ...d, widgets: d.widgets.filter(w => w.instanceId !== instanceId) }
              : d
          ),
          savedAt: Date.now(),
        }))
      },

      updateLayout: (dashboardId, layouts) => {
        set((state) => ({
          dashboards: state.dashboards.map(d => {
            if (d.id !== dashboardId) return d
            return {
              ...d,
              widgets: d.widgets.map(w => {
                const newLayout = layouts.find(l => l.instanceId === w.instanceId)
                return newLayout
                  ? { ...w, layout: { x: newLayout.x, y: newLayout.y, w: newLayout.w, h: newLayout.h } }
                  : w
              }),
            }
          }),
          savedAt: Date.now(),
        }))
      },

      mergeDashboardFromDevice: (payload) => {
        const current = get()
        if (payload.savedAt <= (current.savedAt ?? 0)) return
        set({
          dashboards:        payload.dashboards,
          activeDashboardId: payload.activeDashboardId,
          savedAt:           payload.savedAt,
        })
      },
    }),
    {
      name: 'astra-dashboards',
    }
  )
)
