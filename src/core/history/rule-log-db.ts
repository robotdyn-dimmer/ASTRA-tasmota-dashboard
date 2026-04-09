/**
 * RuleLogDB — IndexedDB store for rule execution history.
 * DB: "astra-history" (shared with sensor-history-db)
 * Store: "rule-log"  keyPath: "id"
 * Index: "by_rule"   → ruleId
 * Retention: 7 days, max 500 entries total
 */

import type { RuleLogEntry } from '@/features/rules/store/rule-store.types'

const DB_NAME    = 'astra-rule-log'  // separate DB to avoid version conflicts with sensor-history
const DB_VERSION = 1
const STORE      = 'rule-log'

const MAX_AGE_MS  = 7 * 24 * 60 * 60 * 1000

class RuleLogDB {
  private db:      IDBDatabase | null = null
  private opening: Promise<IDBDatabase> | null = null

  private open(): Promise<IDBDatabase> {
    if (this.db)      return Promise.resolve(this.db)
    if (this.opening) return this.opening

    this.opening = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION)

      req.onupgradeneeded = (e) => {
        const db = (e.target as IDBOpenDBRequest).result
        if (!db.objectStoreNames.contains(STORE)) {
          const s = db.createObjectStore(STORE, { keyPath: 'id' })
          s.createIndex('by_rule',      'ruleId')
          s.createIndex('by_timestamp', 'firedAt')
        }
      }

      req.onsuccess = (e) => {
        this.db      = (e.target as IDBOpenDBRequest).result
        this.opening = null
        this.cleanup()
        resolve(this.db)
      }

      req.onerror = () => {
        this.opening = null
        reject(req.error)
      }
    })

    return this.opening
  }

  async append(entry: RuleLogEntry): Promise<void> {
    const db = await this.open()
    return new Promise((resolve, reject) => {
      const tx    = db.transaction(STORE, 'readwrite')
      const store = tx.objectStore(STORE)
      store.put(entry)
      tx.oncomplete = () => resolve()
      tx.onerror    = () => reject(tx.error)
    })
  }

  async getByRule(ruleId: string, limit = 50): Promise<RuleLogEntry[]> {
    const db = await this.open()
    return new Promise((resolve, reject) => {
      const tx    = db.transaction(STORE, 'readonly')
      const index = tx.objectStore(STORE).index('by_rule')
      const req   = index.getAll(IDBKeyRange.only(ruleId), limit)
      req.onsuccess = () => resolve((req.result as RuleLogEntry[]).reverse())
      req.onerror   = () => reject(req.error)
    })
  }

  async getRecent(limit = 100): Promise<RuleLogEntry[]> {
    const db = await this.open()
    return new Promise((resolve, reject) => {
      const tx    = db.transaction(STORE, 'readonly')
      const index = tx.objectStore(STORE).index('by_timestamp')
      const req   = index.getAll(null, limit)
      req.onsuccess = () => resolve((req.result as RuleLogEntry[]).reverse())
      req.onerror   = () => reject(req.error)
    })
  }

  private async cleanup(): Promise<void> {
    const db = await this.open()
    const cutoff = Date.now() - MAX_AGE_MS
    return new Promise((resolve) => {
      const tx    = db.transaction(STORE, 'readwrite')
      const index = tx.objectStore(STORE).index('by_timestamp')
      const req   = index.openCursor(IDBKeyRange.upperBound(cutoff))
      req.onsuccess = (e) => {
        const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result
        if (cursor) { cursor.delete(); cursor.continue() }
      }
      tx.oncomplete = () => resolve()
      tx.onerror    = () => resolve()
    })
  }
}

export const ruleLogDB = new RuleLogDB()
