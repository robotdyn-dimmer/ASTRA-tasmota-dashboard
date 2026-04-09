/**
 * Config sync service — syncs app config between browser stores and hub device.
 *
 * - loadAppConfig(ip)   → GET /astra_app → merge into all stores
 * - startConfigSync()   → subscribe to store changes, debounce 2s → save
 * - stopConfigSync()    → unsubscribe
 *
 * Auto-push is controlled by the `autoSyncEnabled` setting in settings store.
 * Pull and Push buttons always work regardless of this setting.
 */

import { tasmotaHttp } from '@/core/http/tasmota-http-client'
import type { AppConfig } from '@/core/http/tasmota-http-client'
import { useSettingsStore } from '@/features/settings/store/settings-store'
import { useDeviceStore } from '@/features/devices/store/device-store'
import { useDashboardStore } from '@/features/dashboard/store/dashboard-store'

/** Build a snapshot of shared config from all stores */
function buildAppConfig(): AppConfig {
  const settings  = useSettingsStore.getState()
  const devices   = useDeviceStore.getState().devices
  const dashboard = useDashboardStore.getState()

  return {
    version: 1,
    savedAt: Date.now(),
    settings: {
      mqttBrokerUrl:  settings.mqttBrokerUrl,
      mqttUsername:    settings.mqttUsername,
      mqttPassword:   settings.mqttPassword,
      autoDiscovery:  settings.autoDiscovery,
      widgetPlugins:  settings.widgetPlugins,
      configDeviceIp: settings.configDeviceIp,
    },
    devices,
    dashboards:        dashboard.dashboards,
    activeDashboardId: dashboard.activeDashboardId,
  }
}

/** Load app config from hub device and merge into stores */
export async function loadAppConfig(ip: string): Promise<boolean> {
  const config = await tasmotaHttp.getAppConfig(ip)
  if (!config) return false

  // Suppress sync during merge to avoid echo-saving back to device
  _suppressSync = true
  try {
    if (config.settings) {
      useSettingsStore.getState().mergeFromDevice(config.settings)
    }
    if (config.devices && Object.keys(config.devices).length > 0) {
      useDeviceStore.getState().mergeDevicesFromDevice(config.devices)
    }
    if (config.dashboards) {
      useDashboardStore.getState().mergeDashboardFromDevice({
        savedAt:           config.savedAt,
        dashboards:        config.dashboards,
        activeDashboardId: config.activeDashboardId ?? null,
      })
    }
  } finally {
    _suppressSync = false
    _lastSnapshot = JSON.stringify(buildAppConfig())
  }

  return true
}

/** Push current config to hub device */
async function saveAppConfigToDevice(): Promise<boolean> {
  const { configDeviceIp } = useSettingsStore.getState()
  if (!configDeviceIp) return false
  return tasmotaHttp.saveAppConfig(configDeviceIp, buildAppConfig())
}

// ── Debounced auto-sync ──────────────────────────────────────────────────────

let _syncTimer: ReturnType<typeof setTimeout> | null = null
let _unsubscribers: Array<() => void> = []
let _lastSnapshot = ''
let _suppressSync = false

function debouncedSave(): void {
  if (_suppressSync) return
  // Only auto-push if user explicitly enabled it
  if (!useSettingsStore.getState().autoSyncEnabled) return
  // Quick check: did the config actually change?
  const snap = JSON.stringify(buildAppConfig())
  if (snap === _lastSnapshot) return
  _lastSnapshot = snap

  if (_syncTimer) clearTimeout(_syncTimer)
  _syncTimer = setTimeout(() => {
    _syncTimer = null
    saveAppConfigToDevice().catch(() => {})
  }, 2000)
}

/** Start watching all stores for changes → debounce save to device */
export function startConfigSync(): void {
  stopConfigSync()

  // Take initial snapshot to avoid saving on first subscribe trigger
  _lastSnapshot = JSON.stringify(buildAppConfig())

  _suppressSync = false

  _unsubscribers.push(useSettingsStore.subscribe(() => debouncedSave()))
  _unsubscribers.push(useDeviceStore.subscribe(() => debouncedSave()))
  _unsubscribers.push(useDashboardStore.subscribe(() => debouncedSave()))
}

/** Stop watching stores */
export function stopConfigSync(): void {
  if (_syncTimer) {
    clearTimeout(_syncTimer)
    _syncTimer = null
  }
  _unsubscribers.forEach(unsub => unsub())
  _unsubscribers = []
}

/** Temporarily suppress sync (used during loadAppConfig to avoid echo) */
export function suppressConfigSync(fn: () => void): void {
  _suppressSync = true
  try { fn() } finally { _suppressSync = false }
}
