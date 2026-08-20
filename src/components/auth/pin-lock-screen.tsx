'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Lock,
  Delete,
  RotateCcw,
  AlertCircle,
  Hotel,
  ShieldCheck,
  ShieldAlert,
  Loader2,
} from 'lucide-react'
import { verifyStayPin } from '@/actions/auth-actions'
import { useDineScanStore } from '@/lib/store/useStore'
import { GuestTabSession } from '@/lib/data/restaurant-data'

interface PinLockScreenProps {
  locationIdentifier: string
  locationName: string
  propertyName: string
  onSuccess?: (session: GuestTabSession) => void
}

export function PinLockScreen({
  locationIdentifier,
  locationName,
  propertyName,
  onSuccess,
}: PinLockScreenProps) {
  const [pin, setPin] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [lockoutRemaining, setLockoutRemaining] = useState<number | null>(null)
  const setSession = useDineScanStore((state) => state.setSession)

  const handleSubmit = useCallback(
    async (pinToSubmit: string) => {
      if (pinToSubmit.length !== 4 || isLoading) return

      setIsLoading(true)
      setError(null)

      try {
        const result = await verifyStayPin(locationIdentifier, pinToSubmit)
        if (result.success && result.session) {
          setSession(result.session)
          if (onSuccess) {
            onSuccess(result.session)
          }
        } else {
          setError(result.error || 'Invalid PIN. Please try again.')
          if (result.lockoutRemainingSeconds) {
            setLockoutRemaining(result.lockoutRemainingSeconds)
          }
          setPin('')
        }
      } catch {
        setError('Verification failed. Please check network connection.')
        setPin('')
      } finally {
        setIsLoading(false)
      }
    },
    [locationIdentifier, isLoading, onSuccess, setSession]
  )

  const handleKeyPress = useCallback(
    (digit: string) => {
      if (isLoading || (lockoutRemaining && lockoutRemaining > 0)) return
      setError(null)
      if (pin.length < 4) {
        const nextPin = pin + digit
        setPin(nextPin)
        if (nextPin.length === 4) {
          handleSubmit(nextPin)
        }
      }
    },
    [pin, isLoading, lockoutRemaining, handleSubmit]
  )

  const handleDelete = useCallback(() => {
    if (isLoading || (lockoutRemaining && lockoutRemaining > 0)) return
    setError(null)
    setPin((prev) => prev.slice(0, -1))
  }, [isLoading, lockoutRemaining])

  const handleClear = useCallback(() => {
    if (isLoading || (lockoutRemaining && lockoutRemaining > 0)) return
    setError(null)
    setPin('')
  }, [isLoading, lockoutRemaining])

  // Listen to physical keyboard typing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) {
        handleKeyPress(e.key)
      } else if (e.key === 'Backspace') {
        handleDelete()
      } else if (e.key === 'Escape') {
        handleClear()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyPress, handleDelete, handleClear])

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-md p-6 text-center">
        {/* Header Metadata */}
        <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400 mb-2">
          <Hotel className="w-3.5 h-3.5" />
          <span>{propertyName}</span>
        </div>

        <div className="flex items-center justify-center gap-2 mb-1">
          <Lock className="w-4 h-4 text-slate-400" />
          <h1 className="text-base font-semibold text-slate-100">
            {locationName}
          </h1>
        </div>

        <p className="text-xs text-slate-400 mb-5">
          Enter your 4-digit stay PIN to access dining and your room tab.
        </p>

        {/* 4-Digit Display */}
        <div className="flex items-center justify-center gap-2.5 my-4">
          {[0, 1, 2, 3].map((index) => {
            const isFilled = pin[index] !== undefined
            return (
              <div
                key={index}
                className={`w-10 h-12 rounded-md flex items-center justify-center border font-mono text-base font-bold ${
                  isFilled
                    ? 'bg-slate-800 border-slate-600 text-slate-100'
                    : 'bg-slate-950 border-slate-800 text-slate-600'
                }`}
              >
                {isFilled ? '•' : ''}
              </div>
            )
          })}
        </div>

        {/* Error Feedback */}
        {error && (
          <div className="flex items-start gap-1.5 text-xs text-red-400 bg-red-950/40 border border-red-900 p-2 rounded-md my-3 text-left">
            {lockoutRemaining ? (
              <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            )}
            <span>{error}</span>
          </div>
        )}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400 py-1 font-mono">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Verifying PIN...</span>
          </div>
        )}

        {/* Numeric Keypad */}
        <div className="grid grid-cols-3 gap-2 w-full max-w-[240px] mx-auto mt-3">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              disabled={isLoading || (lockoutRemaining !== null && lockoutRemaining > 0)}
              onClick={() => handleKeyPress(digit)}
              className="h-11 rounded-md bg-slate-950 hover:bg-slate-800 border border-slate-800 text-sm font-mono font-medium text-slate-100 transition-colors flex items-center justify-center disabled:opacity-40 select-none cursor-pointer"
            >
              {digit}
            </button>
          ))}

          <button
            type="button"
            disabled={isLoading || pin.length === 0}
            onClick={handleClear}
            className="h-11 rounded-md bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs text-slate-400 hover:text-slate-200 transition-colors flex items-center justify-center disabled:opacity-30 select-none cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1" />
            <span>Clear</span>
          </button>

          <button
            type="button"
            disabled={isLoading || (lockoutRemaining !== null && lockoutRemaining > 0)}
            onClick={() => handleKeyPress('0')}
            className="h-11 rounded-md bg-slate-950 hover:bg-slate-800 border border-slate-800 text-sm font-mono font-medium text-slate-100 transition-colors flex items-center justify-center disabled:opacity-40 select-none cursor-pointer"
          >
            0
          </button>

          <button
            type="button"
            disabled={isLoading || pin.length === 0}
            onClick={handleDelete}
            className="h-11 rounded-md bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 transition-colors flex items-center justify-center disabled:opacity-30 select-none cursor-pointer"
          >
            <Delete className="w-4 h-4" />
          </button>
        </div>

        {/* Security Footer */}
        <div className="mt-5 pt-4 border-t border-slate-800 text-[11px] text-slate-500 space-y-1">
          <div className="flex items-center justify-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
            <span>Encrypted Room Verification</span>
          </div>
          <p>
            Contact front desk if you forgot your stay PIN.
          </p>
        </div>
      </div>
    </div>
  )
}
