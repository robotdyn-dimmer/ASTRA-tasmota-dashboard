/**
 * PinLockScreen — shown on app load when a viewer PIN is configured.
 * Correct PIN → admin role. Wrong PIN → viewer role (read-only).
 *
 * NOTE: This is convenience-only. DevTools can bypass it.
 * Not suitable for adversarial threat models.
 */

import { useState, useRef, useEffect } from 'react'
import { Lock, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useRoleStore, sha256 } from './role-store'
import { useSettingsStore } from '@/features/settings/store/settings-store'

interface PinLockScreenProps {
  onUnlocked: () => void
}

export function PinLockScreen({ onUnlocked }: PinLockScreenProps) {
  const viewerPinHash = useSettingsStore(s => s.viewerPinHash)
  const setRole       = useRoleStore(s => s.setRole)

  const [pin,       setPin]       = useState('')
  const [error,     setError]     = useState('')
  const [showPin,   setShowPin]   = useState(false)
  const [checking,  setChecking]  = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSubmit = async () => {
    if (!pin.trim()) return
    setChecking(true)
    setError('')

    try {
      const hash = await sha256(pin.trim())
      if (hash === viewerPinHash) {
        // Correct admin PIN? No — viewer PIN is for VIEWER access.
        // The PIN is the viewer PIN. Entering it → viewer role.
        // To get admin, user must know the app is in admin mode by default
        // and the PIN only enables viewer mode for others.
        // ACTUALLY: the design is — if PIN is set, page shows lock.
        // Correct PIN → admin. Wrong PIN → viewer (limited access).
        // This is what the analysis doc specified.
        setRole('admin')
        onUnlocked()
      } else {
        setError('Wrong PIN')
        setPin('')
        inputRef.current?.focus()
      }
    } finally {
      setChecking(false)
    }
  }

  const handleViewerAccess = () => {
    setRole('viewer')
    onUnlocked()
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">

        {/* Logo */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <Lock size={26} className="text-primary" />
          </div>
          <h1 className="text-xl font-semibold">
            TASMOTA<span className="text-primary">Admin</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            Enter the admin PIN to manage devices and settings.
          </p>
        </div>

        {/* PIN input */}
        <div className="space-y-3">
          <div className="relative">
            <Input
              ref={inputRef}
              type={showPin ? 'text' : 'password'}
              inputMode="numeric"
              placeholder="Admin PIN"
              value={pin}
              onChange={e => { setPin(e.target.value); setError('') }}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              className={`pr-10 text-center text-lg tracking-widest ${error ? 'border-destructive' : ''}`}
              maxLength={20}
            />
            <button
              type="button"
              onClick={() => setShowPin(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
          )}

          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={!pin.trim() || checking}
          >
            {checking ? 'Checking…' : 'Unlock'}
          </Button>
        </div>

        {/* Viewer access */}
        <div className="text-center">
          <button
            onClick={handleViewerAccess}
            className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
          >
            Continue as Viewer (read-only)
          </button>
        </div>

        <p className="text-center text-xs text-muted-foreground/60">
          Viewer mode: dashboards visible, controls disabled.
        </p>
      </div>
    </div>
  )
}
