'use client'

import {
  Receipt,
  ShoppingBag,
  ChevronUp,
} from 'lucide-react'
import { useDineScanStore } from '@/lib/store/useStore'

export function ContinuousTabBar() {
  const {
    guestSession,
    cart,
    setTabDrawerOpen,
    setCartOpen,
  } = useDineScanStore()

  if (!guestSession) return null

  const cartItemsCount = cart.reduce((acc, it) => acc + it.quantity, 0)
  const cartSubtotal = cart.reduce((acc, it) => acc + it.item.price * it.quantity, 0)

  return (
    <div className="fixed bottom-0 inset-x-0 z-40 p-3 sm:p-4 pointer-events-none flex justify-center">
      <div className="pointer-events-auto w-full max-w-2xl bg-white border border-slate-200 rounded-md p-3 flex items-center justify-between gap-3 text-slate-900 shadow-lg">
        {/* Left: Tab Summary */}
        <button
          onClick={() => setTabDrawerOpen(true)}
          className="flex items-center gap-2.5 text-left hover:opacity-90 transition-opacity cursor-pointer"
        >
          <div className="w-8 h-8 rounded-md bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-700">
            <Receipt className="w-4 h-4" />
          </div>

          <div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
              <span>Continuous Tab</span>
              <span className="text-[10px] font-mono text-emerald-700 border border-emerald-200 bg-emerald-50 px-1 rounded font-semibold">
                Active
              </span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-sm sm:text-base font-mono font-bold text-slate-900">
                ₹{guestSession.totalAmount.toFixed(2)}
              </span>
              <span className="text-[11px] text-slate-400 font-mono hidden sm:inline">
                ({guestSession.rounds.length} round{guestSession.rounds.length === 1 ? '' : 's'})
              </span>
            </div>
          </div>
        </button>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTabDrawerOpen(true)}
            className="px-2.5 py-1.5 rounded-md bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-medium text-slate-700 transition-colors flex items-center gap-1 cursor-pointer"
          >
            <Receipt className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">View Folio</span>
            <ChevronUp className="w-3.5 h-3.5" />
          </button>

          {cartItemsCount > 0 ? (
            <button
              onClick={() => setCartOpen(true)}
              className="px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>
                Append ({cartItemsCount}) &bull; ₹{cartSubtotal.toFixed(2)}
              </span>
            </button>
          ) : (
            <button
              onClick={() => setCartOpen(true)}
              className="px-2.5 py-1.5 rounded-md bg-white hover:bg-slate-50 border border-slate-200 text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Cart (0)</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
