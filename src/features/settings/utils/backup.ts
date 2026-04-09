/**
 * Export / Import ASTRA config as a JSON backup file.
 * Covers: devices (metadata), dashboards, settings.
 * deviceStates and sensor history are NOT included (runtime-only).
 */

const BACKUP_VERSION = 1

interface BackupFile {
  version:    number
  exportedAt: string
  appVersion: string
  settings:   unknown
  devices:    unknown
  dashboards: unknown
}

export function exportConfig(): void {
  const backup: BackupFile = {
    version:    BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    appVersion: '0.1.0',
    settings:   safeParseLS('astra-settings'),
    devices:    safeParseLS('astra-devices'),
    dashboards: safeParseLS('astra-dashboards'),
  }

  const json = JSON.stringify(backup, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url  = URL.createObjectURL(blob)

  const a    = document.createElement('a')
  a.href     = url
  a.download = `astra-backup-${formatDate(new Date())}.json`
  a.click()

  URL.revokeObjectURL(url)
}

export function importConfig(file: File): Promise<{ ok: boolean; error?: string }> {
  return new Promise(resolve => {
    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const text   = e.target?.result as string
        const backup = JSON.parse(text) as BackupFile

        if (!backup.version || !backup.exportedAt) {
          return resolve({ ok: false, error: 'Invalid backup file format' })
        }
        if (backup.version > BACKUP_VERSION) {
          return resolve({ ok: false, error: `Backup version ${backup.version} is newer than supported (${BACKUP_VERSION})` })
        }

        // Restore each store
        if (backup.settings)   localStorage.setItem('astra-settings',   JSON.stringify(backup.settings))
        if (backup.devices)    localStorage.setItem('astra-devices',    JSON.stringify(backup.devices))
        if (backup.dashboards) localStorage.setItem('astra-dashboards', JSON.stringify(backup.dashboards))

        resolve({ ok: true })
      } catch {
        resolve({ ok: false, error: 'Could not parse backup file' })
      }
    }

    reader.onerror = () => resolve({ ok: false, error: 'Could not read file' })
    reader.readAsText(file)
  })
}

// ── Helpers ──────────────────────────────────────────────────────

function safeParseLS(key: string): unknown {
  try { return JSON.parse(localStorage.getItem(key) || 'null') } catch { return null }
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}
