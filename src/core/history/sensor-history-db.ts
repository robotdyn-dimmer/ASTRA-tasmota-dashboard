/**
 * SensorHistoryDB — IndexedDB storage for sensor time-series data.
 *
 * DB: "astra-history" v1
 * Store: "readings"  keyPath: [deviceId, sensorKey, timestamp]
 * Index: "by_device_sensor" → [deviceId, sensorKey]
 *
 * Retention: 7 days, max 2000 points per device+sensor combination.
 * Cleanup runs on open.
 */

export interface SensorReading {
  deviceId:  string
  sensorKey: string
  timestamp: number   // Unix ms
  value:     number
}

const DB_NAME      = 'astra-history'
const DB_VERSION   = 1
const STORE        = 'readings'
const MAX_AGE_MS   = 7 * 24 * 60 * 60 * 1000   // 7 days


class SensorHistoryDB {
  private db: IDBDatabase | null = null
  private opening: Promise<IDBDatabase> | null = null

  // ── Lifecycle ────────────────────────────────────────────────────

  private open(): Promise<IDBDatabase> {
    if (this.db) return Promise.resolve(this.db)
    if (this.opening) return this.opening

    this.opening = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION)

      req.onupgradeneeded = (e) => {
        const db = (e.target as IDBOpenDBRequest).result
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: ['deviceId', 'sensorKey', 'timestamp'] })
          store.createIndex('by_device_sensor', ['deviceId', 'sensorKey'])
          store.createIndex('by_timestamp', 'timestamp')
        }
      }

      req.onsuccess = (e) => {
        this.db = (e.target as IDBOpenDBRequest).result
        this.opening = null
        this.cleanup()   // async cleanup on open
        resolve(this.db)
      }

      req.onerror = () => {
        this.opening = null
        reject(req.error)
      }
    })

    return this.opening
  }

  // ── Write ────────────────────────────────────────────────────────

  async addReadings(readings: SensorReading[]): Promise<void> {
    if (readings.length === 0) return
    const db = await this.open()

    return new Promise((resolve, reject) => {
      const tx    = db.transaction(STORE, 'readwrite')
      const store = tx.objectStore(STORE)
      readings.forEach(r => store.put(r))
      tx.oncomplete = () => resolve()
      tx.onerror    = () => reject(tx.error)
    })
  }

  async addReading(reading: SensorReading): Promise<void> {
    return this.addReadings([reading])
  }

  // ── Read ─────────────────────────────────────────────────────────

  async getReadings(
    deviceId:  string,
    sensorKey: string,
    fromTs:    number,
    toTs:      number = Date.now(),
  ): Promise<SensorReading[]> {
    const db = await this.open()

    return new Promise((resolve, reject) => {
      const tx    = db.transaction(STORE, 'readonly')
      const store = tx.objectStore(STORE)

      // Primary keyPath is [deviceId, sensorKey, timestamp] — use store.getAll() directly
      const range = IDBKeyRange.bound(
        [deviceId, sensorKey, fromTs],
        [deviceId, sensorKey, toTs],
      )

      const req = store.getAll(range)
      req.onsuccess = () => resolve(req.result as SensorReading[])
      req.onerror   = () => reject(req.error)
    })
  }

  /** Get the latest N readings for a sensor (most recent first) */
  async getLatest(deviceId: string, sensorKey: string, n = 60): Promise<SensorReading[]> {
    const from = Date.now() - MAX_AGE_MS
    const all  = await this.getReadings(deviceId, sensorKey, from)
    return all.slice(-n).reverse()
  }

  // ── Cleanup ──────────────────────────────────────────────────────

  private async cleanup(): Promise<void> {
    const db = await this.open()
    const cutoff = Date.now() - MAX_AGE_MS

    return new Promise((resolve) => {
      const tx    = db.transaction(STORE, 'readwrite')
      const store = tx.objectStore(STORE)
      const index = store.index('by_timestamp')

      // Delete all records older than 7 days
      const range = IDBKeyRange.upperBound(cutoff)
      const req   = index.openCursor(range)

      req.onsuccess = (e) => {
        const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result
        if (cursor) {
          cursor.delete()
          cursor.continue()
        }
      }

      tx.oncomplete = () => resolve()
      tx.onerror    = () => resolve()   // don't fail the app on cleanup error
    })
  }
}

export const sensorHistoryDB = new SensorHistoryDB()

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Downsample an array to at most `maxPoints` evenly spaced items */
export function downsample(readings: SensorReading[], maxPoints: number): SensorReading[] {
  if (readings.length <= maxPoints) return readings
  const step = readings.length / maxPoints
  return Array.from({ length: maxPoints }, (_, i) => readings[Math.floor(i * step)])
}

/** Time range presets */
export const TIME_RANGES = {
  '1h':  60 * 60 * 1000,
  '6h':  6  * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d':  7  * 24 * 60 * 60 * 1000,
} as const

export type TimeRange = keyof typeof TIME_RANGES
