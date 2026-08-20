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
      <div className="pointer-events-auto w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-md p-3 flex items-center justify-between gap-3 text-slate-100">
        {/* Left: Tab Summary */}
        <button
          onClick={() => setTabDrawerOpen(true)}
          className="flex items-center gap-2.5 text-left hover:opacity-90 transition-opacity cursor-pointer"
        >
          <div className="w-8 h-8 rounded-md bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
            <Receipt className="w-4 h-4" />
          </div>

          <div>
            <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
              <span>Continuous Tab</span>
              <span className="text-[10px] font-mono text-emerald-400 border border-emerald-900/60 bg-emerald-950/40 px-1 rounded">
                Active
              </span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-sm sm:text-base font-mono font-bold text-slate-100">
                ₹{guestSession.totalAmount.toFixed(2)}
              </span>
              <span className="text-[11px] text-slate-500 font-mono hidden sm:inline">
                ({guestSession.rounds.length} round{guestSession.rounds.length === 1 ? '' : 's'})
              </span>
            </div>
          </div>
        </button>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTabDrawerOpen(true)}
            className="px-2.5 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 transition-colors flex items-center gap-1 cursor-pointer"
          >
            <Receipt className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden sm:inline">View Folio</span>
            <ChevronUp className="w-3.5 h-3.5" />
          </button>

          {cartItemsCount > 0 ? (
            <button
              onClick={() => setCartOpen(true)}
              className="px-3 py-1.5 rounded-md bg-slate-100 text-slate-950 hover:bg-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>
                Append ({cartItemsCount}) &bull; ₹{cartSubtotal.toFixed(2)}
              </span>
            </button>
          ) : (
            <button
              onClick={() => setCartOpen(true)}
              className="px-2.5 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors flex items-center gap-1 cursor-pointer"
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
