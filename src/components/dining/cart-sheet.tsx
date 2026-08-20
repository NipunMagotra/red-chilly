'use client'

import { useState, useEffect } from 'react'
import {
  X,
  ShoppingBag,
  Plus,
  Minus,
  Trash2,
  AlertCircle,
  Loader2,
  CheckCircle2,
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

  if (!isCartOpen) return null

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
        }, 1500)
      } else {
        if (result.actionRequired === 'FORCE_CHECKOUT') {
          useDineScanStore.getState().clearCart()
          setError(result.error || 'Your room tab has been settled at checkout.')
          setTimeout(() => {
            setCartOpen(false)
            useDineScanStore.getState().setTabDrawerOpen(true)
          }, 1500)
          return
        }

        if (result.actionRequired === 'REAUTH_REQUIRED') {
          useDineScanStore.getState().clearCart()
          setError(result.error || 'Session expired. Please re-enter your stay PIN.')
          setTimeout(() => {
            window.location.reload()
          }, 1500)
          return
        }

        setError(result.error || 'Failed to append order to tab. Please try again.')
      }
    } catch {
      setError('Network connection error. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Order Cart"
      className="fixed inset-0 z-50 flex justify-end"
    >
      {/* Backdrop */}
      <div
        onClick={() => !isSubmitting && setCartOpen(false)}
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs"
      />

      {/* Drawer */}
      <div className="relative z-10 w-full max-w-md bg-white border-l border-slate-200 h-full flex flex-col text-slate-900 overflow-hidden pb-[env(safe-area-inset-bottom)] shadow-2xl">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/75">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-slate-600" />
            <div>
              <h2 className="font-semibold text-sm text-slate-900">Append Order to Tab</h2>
              <p className="text-xs text-slate-500">
                {guestSession?.locationName} &bull; Round #{guestSession ? guestSession.rounds.length + 1 : 1}
              </p>
            </div>
          </div>
          <button
            onClick={() => setCartOpen(false)}
            disabled={isSubmitting}
            className="text-slate-400 hover:text-slate-700 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        {justAppended ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-xs space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-600 mb-1" />
            <h3 className="text-sm font-semibold text-slate-900">Order Sent to Kitchen!</h3>
            <p className="text-slate-500">
              Appended to your continuous tab as Round #{guestSession?.rounds.length}.
            </p>
          </div>
        ) : cart.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-400 text-xs">
            <ShoppingBag className="w-8 h-8 stroke-1 mb-2 text-slate-300" />
            <p className="text-slate-600 font-medium">Your cart is empty</p>
            <p className="text-slate-400 mt-0.5">Select menu items to append them to your tab.</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
            {/* Cart Items */}
            <div className="space-y-2">
              {cart.map((cartItem) => (
                <div
                  key={cartItem.item.id}
                  className="bg-white border border-slate-200 rounded-md p-3 text-xs space-y-2 shadow-2xs"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-medium text-slate-900 block">
                        {cartItem.item.name}
                      </span>
                      <span className="text-[11px] font-mono text-slate-500">
                        ₹{cartItem.item.price.toFixed(2)} each
                      </span>
                    </div>

                    <span className="font-mono font-bold text-slate-900">
                      ₹{(cartItem.item.price * cartItem.quantity).toFixed(2)}
                    </span>
                  </div>

                  {/* Quantity controls */}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() =>
                          cartItem.quantity > 1
                            ? updateQuantity(cartItem.item.id, cartItem.quantity - 1)
                            : removeFromCart(cartItem.item.id)
                        }
                        className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 border border-slate-200 flex items-center justify-center text-slate-700 text-xs cursor-pointer"
                      >
                        <Minus className="w-3 h-3" />
                      </button>

                      <span className="w-6 text-center font-mono font-bold text-xs text-slate-900">
                        {cartItem.quantity}
                      </span>

                      <button
                        onClick={() => updateQuantity(cartItem.item.id, cartItem.quantity + 1)}
                        className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 border border-slate-200 flex items-center justify-center text-slate-700 text-xs cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <button
                      onClick={() => removeFromCart(cartItem.item.id)}
                      className="text-slate-400 hover:text-red-600 p-1 cursor-pointer"
                      title="Remove item"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Kitchen Instructions */}
            <div className="pt-2">
              <label className="text-xs font-medium text-slate-700 block mb-1">
                Kitchen Instructions (Optional)
              </label>
              <textarea
                value={specialInstructions}
                onChange={(e) => setSpecialInstructions(e.target.value)}
                placeholder="e.g. Extra napkins, dressing on the side..."
                rows={2}
                className="w-full bg-white border border-slate-300 rounded-md p-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 shadow-2xs"
              />
            </div>

            {/* Error Feedback */}
            {error && (
              <div className="p-2.5 rounded-md bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        {cart.length > 0 && !justAppended && (
          <div className="p-4 border-t border-slate-200 bg-white space-y-3">
            <div className="space-y-1 text-xs font-mono">
              <div className="flex justify-between text-slate-500">
                <span>Items Subtotal:</span>
                <span>₹{cartSubtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Est. Dining Tax:</span>
                <span>₹{cartTax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-slate-900 pt-1.5 border-t border-slate-100 text-sm">
                <span>Round Total:</span>
                <span className="text-blue-700 font-bold">₹{cartTotal.toFixed(2)}</span>
              </div>
            </div>

            <button
              onClick={handleAppendToTab}
              disabled={isSubmitting}
              className="w-full py-2.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-xs transition-colors"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Sending to Kitchen...</span>
                </>
              ) : (
                <>
                  <span>Send Order to Room Tab (₹{cartTotal.toFixed(2)})</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
