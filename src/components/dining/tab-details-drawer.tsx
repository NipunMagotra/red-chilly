'use client'

import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  Receipt,
  Clock,
  ShoppingBag,
  CreditCard,
} from 'lucide-react'
import { useDineScanStore } from '@/lib/store/useStore'
import { InvoiceDownloadButton } from '@/components/invoice/invoice-download-button'

export function TabDetailsDrawer() {
  const { guestSession, isTabDrawerOpen, setTabDrawerOpen } = useDineScanStore()

  // Body scroll lock & Escape key handling
  useEffect(() => {
    if (isTabDrawerOpen) {
      document.body.style.overflow = 'hidden'
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          setTabDrawerOpen(false)
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
  }, [isTabDrawerOpen, setTabDrawerOpen])

  if (!guestSession) return null

  return (
    <AnimatePresence>
      {isTabDrawerOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Continuous Tab Breakdown"
          className="fixed inset-0 z-50 flex justify-end"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setTabDrawerOpen(false)}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm"
          />

          {/* Drawer Content */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 250 }}
            className="relative z-10 w-full max-w-md bg-slate-900 border-l border-slate-800 h-full flex flex-col text-slate-100 shadow-2xl overflow-hidden pb-[env(safe-area-inset-bottom)]"
          >
            {/* Drawer Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-red-600/20 border border-red-500/30 flex items-center justify-center text-red-400">
                  <Receipt className="w-5 h-5 text-red-500" />
                </div>
                <div>
                  <h2 className="font-bold text-base text-white">Continuous Tab</h2>
                  <p className="text-xs text-slate-400">
                    {guestSession.locationName} &bull; {guestSession.guestName}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setTabDrawerOpen(false)}
                aria-label="Close Tab Breakdown"
                className="w-10 h-10 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tab Summary Status Banner */}
            <div className="p-4 bg-gradient-to-r from-red-950/40 via-slate-900 to-amber-950/30 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                  Active Room Tab
                </span>
              </div>
              <span className="text-xs text-slate-400 font-mono">
                {guestSession.rounds.length} Round{guestSession.rounds.length === 1 ? '' : 's'} Placed
              </span>
            </div>

            {/* Order Rounds List */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {guestSession.rounds.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-center text-slate-500">
                  <ShoppingBag className="w-12 h-12 stroke-1 mb-2 text-slate-600" />
                  <p className="text-sm font-medium text-slate-400">No orders placed yet</p>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs">
                    Browse the menu and append dishes to your room tab.
                  </p>
                </div>
              ) : (
                guestSession.rounds.map((round) => (
                  <div
                    key={round.id}
                    className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 shadow-sm"
                  >
                    {/* Round Header */}
                    <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-3">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-md bg-red-900/40 border border-red-500/30 text-red-400 text-xs font-bold font-mono">
                          Round #{round.roundNumber}
                        </span>
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-500" />
                          <span>
                            {new Date(round.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </span>
                      </div>
                      <span className="text-xs font-mono font-bold text-white">
                        ₹{round.total.toFixed(2)}
                      </span>
                    </div>

                    {/* Round Items */}
                    <div className="space-y-2.5">
                      {round.items.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-start justify-between text-xs"
                        >
                          <div className="flex-1">
                            <span className="text-slate-200 font-medium">
                              {item.name}
                            </span>
                            <span className="text-slate-400 font-mono ml-2">
                              &times; {item.isVoided ? 0 : item.quantity}
                            </span>
                            {item.notes && (
                              <p className="text-[11px] text-slate-400 italic mt-0.5">
                                Note: {item.notes}
                              </p>
                            )}
                            {item.isVoided && (
                              <p className="text-[11px] text-red-400 font-bold mt-0.5">
                                [VOIDED: {item.voidReason || 'Out of stock'}]
                              </p>
                            )}
                          </div>
                          <span className={`font-mono ${item.isVoided ? 'text-slate-500 line-through' : 'text-slate-300'}`}>
                            ₹{(item.isVoided ? 0 : item.subtotal || item.price * item.quantity).toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>

                    {round.specialInstructions && (
                      <div className="mt-3 pt-2.5 border-t border-slate-800/80 text-[11px] text-amber-400/90 italic">
                        Instructions: {round.specialInstructions}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Financial Summary & Live Total */}
            <div className="p-5 border-t border-slate-800 bg-slate-950/90 space-y-4">
              <div className="space-y-2 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Food &amp; Beverage Subtotal</span>
                  <span className="font-mono">₹{guestSession.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Resort &amp; Dining Tax</span>
                  <span className="font-mono">₹{guestSession.tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-base font-extrabold text-white pt-2.5 border-t border-slate-800">
                  <span>Current Folio Balance</span>
                  <span className="font-mono text-red-400">
                    ₹{guestSession.totalAmount.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* PDF Invoice Button */}
              <div className="pt-1">
                <InvoiceDownloadButton
                  session={guestSession}
                  variant="outline"
                  label="Download Itemized PDF Folio"
                  className="w-full min-h-[44px]"
                />
              </div>

              <div className="flex items-center justify-center gap-2 text-[11px] text-slate-500">
                <CreditCard className="w-3.5 h-3.5" />
                <span>Automatically charged to room folio upon front desk checkout</span>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
