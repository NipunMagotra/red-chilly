'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  ShoppingBag,
  Plus,
  Minus,
  Trash2,
  MessageSquare,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'
import { useDineScanStore } from '@/lib/store/useStore'
import { appendOrderToTab } from '@/actions/tab-actions'

export function CartSheet() {
  const {
    cart,
    guestSession,
    specialInstructions,
    isCartOpen,
    setCartOpen,
    updateQuantity,
    removeFromCart,
    setSpecialInstructions,
    updateSessionFromAppend,
  } = useDineScanStore()

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [justAppended, setJustAppended] = useState(false)

  // Body scroll lock & Escape key handling
  useEffect(() => {
    if (isCartOpen) {
      document.body.style.overflow = 'hidden'
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && !isSubmitting) {
          setCartOpen(false)
        }
      }
      window.addEventListener('keydown', handleKeyDown)
      return () => {
        document.body.style.overflow = ''
        window.removeEventListener('keydown', handleKeyDown)
      }
    } else {
      document.body.style.overflow = ''
    }
  }, [isCartOpen, isSubmitting, setCartOpen])

  const cartSubtotal = cart.reduce((acc, it) => acc + it.item.price * it.quantity, 0)
  const taxRate = guestSession?.propertyId === 'prop-emerald-bay-resort' ? 0.095 : 0.0825
  const cartTax = Math.round(cartSubtotal * taxRate * 100) / 100
  const cartTotal = Math.round((cartSubtotal + cartTax) * 100) / 100

  const handleAppendToTab = async () => {
    if (cart.length === 0 || isSubmitting) return

    setIsSubmitting(true)
    setError(null)

    try {
      const itemsToAppend = cart.map((c) => ({
        menuItemId: c.item.id,
        quantity: c.quantity,
        notes: c.notes,
      }))

      const idempotencyKey = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `idem-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`

      const result = await appendOrderToTab(itemsToAppend, specialInstructions, idempotencyKey)

      if (result.success && result.session) {
        updateSessionFromAppend(result.session)
        setJustAppended(true)
        setTimeout(() => {
          setJustAppended(false)
          setCartOpen(false)
        }, 2000)
      } else {
        if (result.actionRequired === 'FORCE_CHECKOUT') {
          // 1. Immediately purge stale client state
          useDineScanStore.getState().clearCart()
          setError(result.error || 'Your room tab has been settled at checkout.')
          // 2. Transition guest to settled tab view
          setTimeout(() => {
            setCartOpen(false)
            useDineScanStore.getState().setTabDrawerOpen(true)
          }, 1500)
          return
        }

        if (result.actionRequired === 'REAUTH_REQUIRED') {
          useDineScanStore.getState().clearCart()
          setError(result.error || 'Session expired. Please scan your room QR code.')
          setTimeout(() => {
            window.location.reload()
          }, 2000)
          return
        }

        setError(result.error || 'Failed to append to room tab.')
      }
    } catch {
      setError('An error occurred while appending order. Please verify your connection.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isCartOpen) return null

  return (
    <AnimatePresence>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Order Cart Sheet"
        className="fixed inset-0 z-50 flex justify-end"
      >
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => !isSubmitting && setCartOpen(false)}
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm"
        />

        {/* Sheet Content */}
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 250 }}
          className="relative z-10 w-full max-w-md bg-slate-900 border-l border-slate-800 h-full flex flex-col text-slate-100 shadow-2xl overflow-hidden pb-[env(safe-area-inset-bottom)]"
        >
          {/* Header */}
          <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-red-600/20 border border-red-500/30 flex items-center justify-center text-red-400">
                <ShoppingBag className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <h2 className="font-bold text-base text-white">Your Order Batch</h2>
                <p className="text-xs text-slate-400">
                  {cart.length} item{cart.length === 1 ? '' : 's'} ready to append
                </p>
              </div>
            </div>

            <button
              onClick={() => setCartOpen(false)}
              disabled={isSubmitting}
              aria-label="Close Cart"
              className="w-10 h-10 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Success Banner */}
          <AnimatePresence>
            {justAppended && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-emerald-950/90 border-b border-emerald-500/40 p-4 flex items-center gap-3 text-emerald-300 text-xs font-semibold"
              >
                <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                <span>Round successfully appended to your continuous tab! Kitchen is preparing your dishes.</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Error Banner */}
          {error && (
            <div className="bg-red-950/80 border-b border-red-500/30 p-4 flex items-start gap-2.5 text-red-300 text-xs">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Cart Items List */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {cart.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-center text-slate-500">
                <ShoppingBag className="w-12 h-12 stroke-1 mb-2 text-slate-600" />
                <p className="text-sm font-medium text-slate-400">Your cart is empty</p>
                <p className="text-xs text-slate-500 mt-1 max-w-xs">
                  Select dishes from the menu to append them to your continuous room tab.
                </p>
              </div>
            ) : (
              cart.map((cartItem) => (
                <div
                  key={cartItem.item.id}
                  className="bg-slate-950/70 border border-slate-800/90 rounded-2xl p-4 flex flex-col gap-3 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <h4 className="font-semibold text-sm text-white">
                        {cartItem.item.name}
                      </h4>
                      <p className="text-xs font-mono font-bold text-red-400 mt-0.5">
                        ₹{(cartItem.item.price * cartItem.quantity).toFixed(2)}
                      </p>
                    </div>

                    <button
                      onClick={() => removeFromCart(cartItem.item.id)}
                      aria-label={`Remove ${cartItem.item.name}`}
                      className="p-2 text-slate-500 hover:text-red-400 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {cartItem.notes && (
                    <p className="text-xs text-slate-400 italic bg-slate-900/90 px-2.5 py-1.5 rounded-lg border border-slate-800">
                      Note: {cartItem.notes}
                    </p>
                  )}

                  {/* Quantity Stepper (44px touch targets) */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                    <span className="text-xs text-slate-400">Quantity</span>
                    <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl p-1">
                      <button
                        onClick={() => updateQuantity(cartItem.item.id, -1)}
                        aria-label="Decrease quantity"
                        className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="font-mono text-sm font-bold w-6 text-center text-white">
                        {cartItem.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(cartItem.item.id, 1)}
                        aria-label="Increase quantity"
                        className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}

            {/* Special Instructions for Kitchen */}
            {cart.length > 0 && (
              <div className="pt-2">
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-red-400" />
                  <span>Special Kitchen Instructions (Optional)</span>
                </label>
                <textarea
                  value={specialInstructions}
                  onChange={(e) => setSpecialInstructions(e.target.value)}
                  placeholder="e.g. Please deliver to poolside terrace, dressing on the side..."
                  maxLength={500}
                  className="w-full h-20 bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-red-500/50 resize-none transition-colors"
                />
              </div>
            )}
          </div>

          {/* Footer & Append Button */}
          {cart.length > 0 && (
            <div className="p-5 border-t border-slate-800 bg-slate-950/90 space-y-4">
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Batch Subtotal</span>
                  <span className="font-mono">₹{cartSubtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Estimated Tax</span>
                  <span className="font-mono">₹{cartTax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-white pt-2 border-t border-slate-800/80">
                  <span>Batch Total</span>
                  <span className="font-mono text-red-400">₹{cartTotal.toFixed(2)}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleAppendToTab}
                disabled={isSubmitting || justAppended}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 active:scale-[0.99] text-white font-bold text-sm shadow-xl shadow-red-950/60 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-60 min-h-[48px]"
              >
                {isSubmitting ? (
                  <span>Appending to Tab...</span>
                ) : justAppended ? (
                  <span>Round Sent to Kitchen!</span>
                ) : (
                  <>
                    <span>Append to Room Tab &bull; ₹{cartTotal.toFixed(2)}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <p className="text-[11px] text-center text-slate-500">
                Charges append immediately to {guestSession?.locationName || 'Room Tab'} &bull; Settle upon check-out
              </p>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
