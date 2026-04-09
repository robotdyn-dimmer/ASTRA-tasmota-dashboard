import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AutomationRule, RuleStoreState } from './rule-store.types'

const MAX_LOG = 100

export const useRuleStore = create<RuleStoreState>()(
  persist(
    (set) => ({
      rules: {},
      log:   [],

      addRule: (rule) => {
        const id  = `rule_${Date.now()}`
        const now = Date.now()
        const full: AutomationRule = { ...rule, id, fireCount: 0, createdAt: now, updatedAt: now }
        set(s => ({ rules: { ...s.rules, [id]: full } }))
        return id
      },

      updateRule: (id, partial) => {
        set(s => {
          const existing = s.rules[id]
          if (!existing) return s
          return {
            rules: {
              ...s.rules,
              [id]: { ...existing, ...partial, updatedAt: Date.now() },
            },
          }
        })
      },

      deleteRule: (id) => {
        set(s => {
          const { [id]: _, ...rest } = s.rules
          return { rules: rest }
        })
      },

      enableRule: (id, enabled) => {
        set(s => {
          const existing = s.rules[id]
          if (!existing) return s
          return {
            rules: { ...s.rules, [id]: { ...existing, enabled, updatedAt: Date.now() } },
          }
        })
      },

      appendLog: (entry) => {
        set(s => ({
          log: [entry, ...s.log].slice(0, MAX_LOG),
        }))
        // Also persist significant events to IndexedDB (async, fire-and-forget)
        import('@/core/history/rule-log-db').then(m => m.ruleLogDB.append(entry)).catch(() => {})
      },

      clearLog: () => set({ log: [] }),
    }),
    {
      name: 'astra-rules',
      // Don't persist the log (it's transient) or execution metadata
      partialize: (s) => ({
        rules: Object.fromEntries(
          Object.entries(s.rules).map(([k, v]) => [k, v])
        ),
      }),
    }
  )
)
