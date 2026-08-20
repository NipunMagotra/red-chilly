'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Lock,
  Delete,
  RotateCcw,
  AlertCircle,
  Hotel,
  ShieldCheck,
  ShieldAlert,
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
  const [isShaking, setIsShaking] = useState<boolean>(false)
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
          setIsShaking(true)
          setTimeout(() => setIsShaking(false), 600)
          setPin('')
        }
      } catch {
        setError('Verification failed. Please check network connection.')
        setIsShaking(true)
        setTimeout(() => setIsShaking(false), 600)
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
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden selection:bg-red-500 selection:text-white">
      {/* Dynamic Ambient Background Glow */}
      <div className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 w-[550px] h-[550px] bg-gradient-to-tr from-red-600/20 via-orange-500/10 to-purple-600/10 blur-[130px] rounded-full" />
      <div className="pointer-events-none absolute -bottom-32 right-1/4 w-[450px] h-[450px] bg-gradient-to-br from-red-600/15 to-amber-500/10 blur-[120px] rounded-full" />

      {/* Main Lock Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="relative z-10 w-full max-w-md bg-slate-900/80 border border-slate-800/80 backdrop-blur-xl rounded-3xl p-6 sm:p-8 shadow-2xl shadow-red-950/40 flex flex-col items-center text-center"
      >
        {/* Header Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-red-950/60 border border-red-500/30 text-red-400 text-xs font-semibold mb-4">
          <Hotel className="w-3.5 h-3.5 text-red-400" />
          <span>{propertyName}</span>
        </div>

        {/* Location & Challenge Title */}
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-500/20 to-orange-500/10 border border-red-500/30 flex items-center justify-center text-red-400 mb-4 shadow-inner">
          <Lock className="w-8 h-8 text-red-500 animate-pulse" />
        </div>

        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          {locationName}
        </h1>
        <p className="text-slate-400 text-sm mt-1 max-w-xs">
          Enter your 4-digit stay PIN provided at check-in to unlock room dining &amp; continuous tab.
        </p>

        {/* PIN Digit Boxes with Shake Animation */}
        <motion.div
          animate={
            isShaking
              ? { x: [-12, 12, -8, 8, -4, 4, 0] }
              : { x: 0 }
          }
          transition={{ duration: 0.5 }}
          className="flex items-center justify-center gap-3.5 my-6"
        >
          {[0, 1, 2, 3].map((index) => {
            const digit = pin[index]
            const isFilled = digit !== undefined
            return (
              <div
                key={index}
                className={`w-13 h-14 sm:w-14 sm:h-16 rounded-2xl flex items-center justify-center text-2xl font-bold transition-all duration-200 ${
                  isFilled
                    ? 'bg-red-500/20 border-2 border-red-500 text-white shadow-lg shadow-red-950/50 scale-105'
                    : 'bg-slate-800/60 border border-slate-700/80 text-slate-500'
                }`}
              >
                {isFilled ? (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="w-3.5 h-3.5 rounded-full bg-red-400"
                  />
                ) : (
                  <div className="w-2 h-2 rounded-full bg-slate-700" />
                )}
              </div>
            )
          })}
        </motion.div>

        {/* Error Feedback & Lockout Alert */}
        <AnimatePresence mode="wait">
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="flex items-start gap-2 text-xs text-red-400 font-medium bg-red-950/60 border border-red-900/80 p-3 rounded-xl mb-4 text-left w-full"
            >
              {lockoutRemaining ? (
                <ShieldAlert className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              )}
              <span>{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Numeric Keypad */}
        <div className="grid grid-cols-3 gap-2.5 sm:gap-3 w-full max-w-[280px]">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              disabled={isLoading || (lockoutRemaining !== null && lockoutRemaining > 0)}
              onClick={() => handleKeyPress(digit)}
              className="h-13 sm:h-14 rounded-2xl bg-slate-800/70 hover:bg-red-950/50 active:bg-red-600/30 border border-slate-700/60 hover:border-red-500/40 text-xl font-semibold text-white transition-all duration-150 flex items-center justify-center shadow-sm disabled:opacity-40 select-none cursor-pointer"
            >
              {digit}
            </button>
          ))}

          {/* Clear Button */}
          <button
            type="button"
            disabled={isLoading || pin.length === 0}
            onClick={handleClear}
            className="h-13 sm:h-14 rounded-2xl bg-slate-800/40 hover:bg-slate-800 border border-slate-700/40 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-all flex items-center justify-center disabled:opacity-30 select-none cursor-pointer"
          >
            <RotateCcw className="w-4 h-4 mr-1" />
            Clear
          </button>

          {/* 0 Button */}
          <button
            type="button"
            disabled={isLoading || (lockoutRemaining !== null && lockoutRemaining > 0)}
            onClick={() => handleKeyPress('0')}
            className="h-13 sm:h-14 rounded-2xl bg-slate-800/70 hover:bg-red-950/50 active:bg-red-600/30 border border-slate-700/60 hover:border-red-500/40 text-xl font-semibold text-white transition-all duration-150 flex items-center justify-center shadow-sm disabled:opacity-40 select-none cursor-pointer"
          >
            0
          </button>

          {/* Backspace Button */}
          <button
            type="button"
            disabled={isLoading || pin.length === 0}
            onClick={handleDelete}
            className="h-13 sm:h-14 rounded-2xl bg-slate-800/40 hover:bg-slate-800 border border-slate-700/40 text-slate-400 hover:text-slate-200 transition-all flex items-center justify-center disabled:opacity-30 select-none cursor-pointer"
          >
            <Delete className="w-5 h-5" />
          </button>
        </div>

        {/* Security Footer */}
        <div className="mt-6 pt-5 border-t border-slate-800/80 w-full flex flex-col items-center gap-2">
          <div className="inline-flex items-center gap-1.5 text-xs text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Encrypted Room Verification &bull; Multi-Tenant RLS</span>
          </div>
          <p className="text-[11px] text-slate-500">
            Forgot your PIN? Please contact the hotel front desk or reception.
          </p>
        </div>
      </motion.div>
    </div>
  )
}
