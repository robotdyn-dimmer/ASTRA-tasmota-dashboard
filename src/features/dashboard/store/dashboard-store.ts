import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { DashboardLayout, WidgetInstance } from '@/features/widgets/registry/widget-types'

interface DashboardStoreState {
  dashboards: DashboardLayout[]
  activeDashboardId: string | null
  editMode: boolean

  getActiveDashboard: () => DashboardLayout | undefined
  createDashboard: (name: string) => string
  deleteDashboard: (id: string) => void
  setActiveDashboard: (id: string) => void
  setEditMode: (editing: boolean) => void
  addWidget: (dashboardId: string, widget: WidgetInstance) => void
  removeWidget: (dashboardId: string, instanceId: string) => void
  updateLayout: (dashboardId: string, layouts: Array<{ instanceId: string; x: number; y: number; w: number; h: number }>) => void
}

export const useDashboardStore = create<DashboardStoreState>()(
  persist(
    (set, get) => ({
      dashboards: [],
      activeDashboardId: null,
      editMode: false,

      getActiveDashboard: () => {
        const { dashboards, activeDashboardId } = get()
        return dashboards.find(d => d.id === activeDashboardId)
      },

      createDashboard: (name) => {
        const id = `dash_${Date.now()}`
        set((state) => ({
          dashboards: [...state.dashboards, { id, name, widgets: [] }],
          activeDashboardId: state.activeDashboardId ?? id,
        }))
        return id
      },

      deleteDashboard: (id) => {
        set((state) => ({
          dashboards: state.dashboards.filter(d => d.id !== id),
          activeDashboardId: state.activeDashboardId === id
            ? state.dashboards[0]?.id ?? null
            : state.activeDashboardId,
        }))
      },

      setActiveDashboard: (id) => set({ activeDashboardId: id }),

      setEditMode: (editing) => set({ editMode: editing }),

      addWidget: (dashboardId, widget) => {
        set((state) => ({
          dashboards: state.dashboards.map(d =>
            d.id === dashboardId
              ? { ...d, widgets: [...d.widgets, widget] }
              : d
          ),
        }))
      },

      removeWidget: (dashboardId, instanceId) => {
        set((state) => ({
          dashboards: state.dashboards.map(d =>
            d.id === dashboardId
              ? { ...d, widgets: d.widgets.filter(w => w.instanceId !== instanceId) }
              : d
          ),
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
        }))
      },
    }),
    {
      name: 'astra-dashboards',
    }
  )
)
