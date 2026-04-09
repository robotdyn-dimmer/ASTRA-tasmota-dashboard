/**
 * role-store.ts — session-only role store (NOT persisted).
 * Role resets to 'viewer' on page reload if a viewer PIN is configured.
 * PIN hash is stored in settingsStore (persisted localStorage).
 */

import { create } from 'zustand'

export type UserRole = 'admin' | 'viewer'

interface RoleStoreState {
  role:      UserRole
  setRole:   (role: UserRole) => void
  isAdmin:   () => boolean
}

export const useRoleStore = create<RoleStoreState>()((set, get) => ({
  role:    'admin',   // default: admin when no PIN configured
  setRole: (role) => set({ role }),
  isAdmin: () => get().role === 'admin',
}))

/** SHA-256 hash of a string (hex) */
export async function sha256(str: string): Promise<string> {
  const buf  = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}
