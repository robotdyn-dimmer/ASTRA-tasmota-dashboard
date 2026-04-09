/**
 * plugin-loader.ts — loads external widget plugins from user-provided URLs.
 *
 * Plugin contract:
 *   The plugin bundle must be an ESM module that exports a default function:
 *   export default function register(registry: WidgetRegistry): void
 *
 * Plugin URLs are stored in settingsStore.widgetPlugins (string[]).
 * Loaded on app startup, after built-in widgets register.
 *
 * Security note: loading arbitrary JS from a URL grants full page access.
 * Only load plugins from trusted sources.
 */

import { widgetRegistry } from './widget-registry'

export interface PluginLoadResult {
  url:     string
  status:  'ok' | 'error'
  error?:  string
  types?:  string[]   // widget types registered by this plugin
}

/**
 * Load a single plugin from a URL.
 * Returns a result object (never throws).
 */
export async function loadPlugin(url: string): Promise<PluginLoadResult> {
  const typesBefore = new Set(widgetRegistry.getAll().map(d => d.type))

  try {
    // Dynamic ESM import — works in modern browsers (Chrome 63+, Firefox 67+)
    // Vite: @vite-ignore suppresses the "dynamic import" warning
    const module = await import(/* @vite-ignore */ url)

    if (typeof module.default !== 'function') {
      return { url, status: 'error', error: 'Plugin must export a default function' }
    }

    module.default(widgetRegistry)

    const typesAfter = widgetRegistry.getAll().map(d => d.type)
    const newTypes   = typesAfter.filter(t => !typesBefore.has(t))

    return { url, status: 'ok', types: newTypes }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { url, status: 'error', error: msg }
  }
}

/**
 * Load all plugins from the settings store.
 * Call once on app startup after built-in widgets are registered.
 */
export async function loadAllPlugins(urls: string[]): Promise<PluginLoadResult[]> {
  if (urls.length === 0) return []
  const results = await Promise.allSettled(urls.map(loadPlugin))
  return results.map((r, i) =>
    r.status === 'fulfilled' ? r.value : { url: urls[i], status: 'error' as const, error: String((r as PromiseRejectedResult).reason) }
  )
}
