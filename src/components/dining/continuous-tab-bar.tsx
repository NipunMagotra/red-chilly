'use client'

import { motion } from 'framer-motion'
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
    <div className="fixed bottom-0 inset-x-0 z-40 p-4 sm:p-6 pointer-events-none flex justify-center">
      <motion.div
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="pointer-events-auto w-full max-w-2xl bg-slate-900/90 border border-slate-700/80 backdrop-blur-xl rounded-2xl sm:rounded-3xl p-3 sm:p-4 shadow-2xl shadow-red-950/70 flex items-center justify-between gap-3 text-slate-100"
      >
        {/* Left: Continuous Tab Running Balance */}
        <button
          onClick={() => setTabDrawerOpen(true)}
          className="flex items-center gap-3 text-left group hover:opacity-90 transition-opacity cursor-pointer"
        >
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 group-hover:scale-105 transition-transform">
              <Receipt className="w-5 h-5" />
            </div>
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
          </div>

          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-300">Continuous Tab</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-500/30 font-medium">
                Active
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-base sm:text-lg font-extrabold font-mono text-white">
                ₹{guestSession.totalAmount.toFixed(2)}
              </span>
              <span className="text-[11px] text-slate-400 font-mono hidden sm:inline">
                ({guestSession.rounds.length} round{guestSession.rounds.length === 1 ? '' : 's'})
              </span>
            </div>
          </div>
        </button>

        {/* Right: Actions (View Tab / Open Cart) */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTabDrawerOpen(true)}
            className="px-3 sm:px-4 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 text-xs font-semibold text-slate-300 hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Receipt className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden sm:inline">Tab Breakdown</span>
            <span className="sm:hidden">Tab</span>
            <ChevronUp className="w-3.5 h-3.5" />
          </button>

          {cartItemsCount > 0 ? (
            <button
              onClick={() => setCartOpen(true)}
              className="px-3.5 sm:px-5 py-2 rounded-xl bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white text-xs sm:text-sm font-bold shadow-lg shadow-red-950/60 flex items-center gap-2 transition-all cursor-pointer animate-pulse"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>
                Append ({cartItemsCount}) &bull; ₹{cartSubtotal.toFixed(2)}
              </span>
            </button>
          ) : (
            <button
              onClick={() => setCartOpen(true)}
              className="px-3 sm:px-4 py-2 rounded-xl bg-slate-800/50 hover:bg-slate-800 border border-slate-700/40 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Cart (0)</span>
            </button>
          )}
        </div>
      </motion.div>
    </div>
  )
}
