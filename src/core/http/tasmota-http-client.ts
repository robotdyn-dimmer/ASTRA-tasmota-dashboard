/**
 * TasmotaHttpClient — singleton for direct HTTP access to Tasmota devices.
 *
 * Usage:
 *   import { tasmotaHttp } from '@/core/http/tasmota-http-client'
 *   const result = await tasmotaHttp.sendCommand('192.168.1.100', 'Status 0')
 *   const result = await tasmotaHttp.sendCommand('localhost:8888/device/1', 'Status 0')
 *
 * Auth: Tasmota uses query params (?user=admin&password=xxx), NOT Basic Auth.
 *
 * CORS / Private Network Access fix:
 *   Chrome 98+ blocks localhost→192.168.x.x requests unless the device sends
 *   Access-Control-Allow-Private-Network: true. Tasmota 15.x on ESP32 does NOT
 *   send this header even with SetOption120 1 (AsyncWebServer limitation).
 *
 *   In dev mode (Vite), all requests to private IP addresses are routed through
 *   the Vite dev server proxy at /device-proxy/<ip>/<path>.
 *   The Vite proxy (Node.js) forwards the request without CORS restrictions.
 */

import type { HttpAuth, HttpResult } from './types'
import { HttpError } from './types'
import { TASMOTA_DEFAULTS } from '@/core/config/constants'
import type { DashboardLayout } from '@/features/widgets/registry/widget-types'
import type { TasmotaDevice } from '@/features/devices/store/device-store.types'

/** Full app config stored on hub device at /astra_app */
export interface AppConfig {
  version:            1
  savedAt:            number
  settings?: {
    mqttBrokerUrl:    string
    mqttUsername:      string
    mqttPassword:     string
    autoDiscovery:    boolean
    widgetPlugins:    string[]
    configDeviceIp:   string
  }
  devices?:           Record<string, TasmotaDevice>
  dashboards?:        DashboardLayout[]
  activeDashboardId?: string | null
}

/** Returns true for local network IPs that need the Vite dev proxy to bypass Chrome PNA */
function isPrivateIp(ipOrHost: string): boolean {
  const host = ipOrHost.split(':')[0].split('/')[0]
  return /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)
}

/** Build the proxied URL for dev mode — routes through Vite's /device-proxy middleware */
function proxyUrl(ip: string, path: string): string {
  // In dev mode, Vite is at the same origin → /device-proxy/<ip>/<path>
  return `/device-proxy/${ip}${path}`
}

const IS_DEV = import.meta.env.DEV

/** Shape of dashboard config synced to/from Berry device at /astra_dash */
export interface DashboardSyncPayload {
  savedAt:           number           // Unix ms — used for conflict resolution
  dashboards:        DashboardLayout[]
  activeDashboardId: string | null
}

const DEFAULT_TIMEOUT = TASMOTA_DEFAULTS.HTTP_TIMEOUT  // 5000ms

class TasmotaHttpClient {
  /**
   * Send a Tasmota command to a device via HTTP.
   * @param ip  Device IP or mock path: "192.168.1.100" | "localhost:8888/device/1"
   * @param command  Tasmota command: "Status 0", "Power TOGGLE", etc.
   * @param auth  Optional credentials (only needed if WebPassword is set on device)
   * @param timeout  Request timeout in ms (default 5000)
   */
  async sendCommand(
    ip: string,
    command: string,
    auth?: HttpAuth,
    timeout = DEFAULT_TIMEOUT,
  ): Promise<HttpResult> {
    const url = this.buildUrl(ip, command, auth)
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeout)

    try {
      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        // No credentials header — Tasmota uses query params for auth
      })

      const text = await response.text()

      if (response.status === 401) {
        throw new HttpError('auth', 'Unauthorized — check device password', 401)
      }
      if (response.status >= 500) {
        throw new HttpError('server', `Server error ${response.status}`, response.status)
      }

      let data: Record<string, unknown>
      try {
        data = JSON.parse(text)
      } catch {
        throw new HttpError('parse', `Invalid JSON: ${text.slice(0, 80)}`)
      }

      return { ok: response.ok, data, status: response.status, timestamp: Date.now() }

    } catch (err) {
      if (err instanceof HttpError) throw err

      const error = err as Error
      if (error.name === 'AbortError') {
        throw new HttpError('timeout', `Request to ${ip} timed out after ${timeout}ms`)
      }
      if (error.message.toLowerCase().includes('cors') ||
          error.message.toLowerCase().includes('fetch')) {
        // Fetch failure on local address → likely CORS (SetOption120 not set)
        throw new HttpError('cors', `CORS blocked — enable SetOption120 1 on device ${ip}`)
      }
      throw new HttpError('network', `Network error: ${error.message}`)
    } finally {
      clearTimeout(timer)
    }
  }

  /** GET full STATUS 0 — all device info */
  async getFullStatus(ip: string, auth?: HttpAuth): Promise<HttpResult> {
    return this.sendCommand(ip, 'STATUS 0', auth)
  }

  /** GET STATUS 8 — sensor + energy data */
  async getSensorStatus(ip: string, auth?: HttpAuth): Promise<HttpResult> {
    return this.sendCommand(ip, 'STATUS 8', auth)
  }

  /** GET /astra_cfg — Berry config endpoint */
  async getAstraConfig(ip: string): Promise<Record<string, unknown>> {
    const url = this.buildDeviceUrl(ip, '/astra_cfg')
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT)
    try {
      const res = await fetch(url, { signal: controller.signal })
      return await res.json()
    } catch {
      return {}
    } finally {
      clearTimeout(timer)
    }
  }

  /** POST /astra_cfg — save Berry config.
   *  No Content-Type header → simple request, no CORS preflight (works with stock Tasmota Cors). */
  async saveAstraConfig(ip: string, config: Record<string, unknown>): Promise<boolean> {
    const url = this.buildDeviceUrl(ip, '/astra_cfg')
    try {
      const res = await fetch(url, { method: 'POST', body: JSON.stringify(config) })
      const json = await res.json()
      return json.ok === true
    } catch {
      return false
    }
  }

  /**
   * GET /astra_dash — pull shared dashboard config from Berry device.
   * Returns null if device offline, endpoint missing, or data invalid.
   */
  async getDashboardConfig(ip: string): Promise<DashboardSyncPayload | null> {
    const url = this.buildDeviceUrl(ip, '/astra_dash')
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 3000)  // shorter timeout for startup
    try {
      const res = await fetch(url, { signal: controller.signal })
      if (!res.ok) return null
      const json = await res.json()
      // Must have savedAt timestamp and dashboards array to be valid
      if (typeof json.savedAt !== 'number' || !Array.isArray(json.dashboards)) return null
      return json as DashboardSyncPayload
    } catch {
      return null
    } finally {
      clearTimeout(timer)
    }
  }

  /**
   * POST /astra_dash — push dashboard config to Berry device for cross-browser sync.
   * Silent on failure — localStorage is always the source of truth.
   * No Content-Type header → simple request, no CORS preflight.
   */
  async saveDashboardConfig(ip: string, payload: DashboardSyncPayload): Promise<boolean> {
    const url = this.buildDeviceUrl(ip, '/astra_dash')
    try {
      const res = await fetch(url, { method: 'POST', body: JSON.stringify(payload) })
      const json = await res.json()
      return json.ok === true
    } catch {
      return false
    }
  }

  /** GET /astra_app — pull full app config from hub device */
  async getAppConfig(ip: string): Promise<AppConfig | null> {
    const url = this.buildDeviceUrl(ip, '/astra_app')
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 5000)
    try {
      const res = await fetch(url, { signal: controller.signal })
      console.log('[getAppConfig] status:', res.status, 'ok:', res.ok, 'url:', url)
      if (!res.ok) return null
      const data = await res.json()
      console.log('[getAppConfig] data:', data, 'savedAt type:', typeof data.savedAt)
      if (typeof data.savedAt !== 'number') return null
      return data as AppConfig
    } catch (err) {
      console.error('[getAppConfig] error:', err)
      return null
    } finally {
      clearTimeout(timer)
    }
  }

  /** POST /astra_app — push full app config to hub device.
   *  No Content-Type header → simple request, no CORS preflight (works with stock Tasmota Cors). */
  async saveAppConfig(ip: string, config: AppConfig): Promise<boolean> {
    const url = this.buildDeviceUrl(ip, '/astra_app')
    try {
      const res = await fetch(url, { method: 'POST', body: JSON.stringify(config) })
      const json = await res.json()
      return json.ok === true
    } catch {
      return false
    }
  }

  // ── Private ──────────────────────────────────────────────────────

  private buildUrl(ip: string, command: string, auth?: HttpAuth): string {
    const params = new URLSearchParams({ cmnd: command })
    if (auth?.username) params.set('user', auth.username)
    if (auth?.password) params.set('password', auth.password)

    // In dev mode, route private IPs through Vite proxy to avoid Chrome PNA restrictions
    if (IS_DEV && isPrivateIp(ip)) {
      return proxyUrl(ip, `/cm?${params.toString()}`)
    }
    return `http://${ip}/cm?${params.toString()}`
  }

  private buildDeviceUrl(ip: string, path: string): string {
    if (IS_DEV && isPrivateIp(ip)) {
      return proxyUrl(ip, path)
    }
    return `http://${ip}${path}`
  }
}

/** Singleton — import and use directly */
export const tasmotaHttp = new TasmotaHttpClient()

export { HttpError }
export type { HttpAuth, HttpResult }
