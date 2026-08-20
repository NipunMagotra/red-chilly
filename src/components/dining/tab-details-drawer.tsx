'use client'

import { useEffect } from 'react'
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

  if (!guestSession || !isTabDrawerOpen) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Continuous Tab Breakdown"
      className="fixed inset-0 z-50 flex justify-end"
    >
      {/* Backdrop */}
      <div
        onClick={() => setTabDrawerOpen(false)}
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs"
      />

      {/* Drawer Content */}
      <div className="relative z-10 w-full max-w-md bg-white border-l border-slate-200 h-full flex flex-col text-slate-900 overflow-hidden pb-[env(safe-area-inset-bottom)] shadow-2xl">
        {/* Drawer Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/75">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-slate-600" />
            <div>
              <h2 className="font-semibold text-sm text-slate-900">Guest Folio &amp; Tab</h2>
              <p className="text-xs text-slate-500">
                {guestSession.locationName} &bull; {guestSession.guestName}
              </p>
            </div>
          </div>
          <button
            onClick={() => setTabDrawerOpen(false)}
            aria-label="Close Tab Breakdown"
            className="text-slate-400 hover:text-slate-700 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Status Bar */}
        <div className="px-4 py-2 bg-white border-b border-slate-100 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 font-mono text-emerald-700">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
            <span className="uppercase text-[10px] font-semibold">
              {guestSession.status === 'settled' || guestSession.status === 'closed'
                ? 'Settled Folio'
                : 'Active Room Tab'}
            </span>
          </div>
          <span className="text-slate-500 font-mono text-[11px]">
            {guestSession.rounds.length} Round{guestSession.rounds.length === 1 ? '' : 's'}
          </span>
        </div>

        {/* Order Rounds List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
          {guestSession.rounds.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center text-center text-slate-400">
              <ShoppingBag className="w-8 h-8 stroke-1 mb-2 text-slate-300" />
              <p className="text-xs font-medium text-slate-600">No orders placed yet</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Browse the menu and append items to your tab.
              </p>
            </div>
          ) : (
            guestSession.rounds.map((round) => (
              <div
                key={round.id}
                className="bg-white border border-slate-200 rounded-md p-3 space-y-2 text-xs shadow-2xs"
              >
                {/* Round Header */}
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 font-mono text-[11px]">
                  <div className="flex items-center gap-1.5 text-slate-800">
                    <span className="font-semibold">Round #{round.roundNumber}</span>
                    <span className="text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>
                        {new Date(round.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </span>
                  </div>
                  <span className="font-bold text-slate-900">
                    ₹{round.total.toFixed(2)}
                  </span>
                </div>

                {/* Round Items */}
                <div className="space-y-1.5">
                  {round.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start justify-between text-xs"
                    >
                      <div className="flex-1">
                        <span className="text-slate-800">
                          {item.name}
                        </span>
                        <span className="text-slate-400 font-mono ml-1.5">
                          &times; {item.isVoided ? 0 : item.quantity}
                        </span>
                        {item.notes && (
                          <p className="text-[10px] text-slate-500 italic mt-0.5">
                            Note: {item.notes}
                          </p>
                        )}
                        {item.isVoided && (
                          <p className="text-[10px] text-red-600 font-mono mt-0.5">
                            [VOIDED: {item.voidReason || 'Out of stock'}]
                          </p>
                        )}
                      </div>
                      <span className={`font-mono text-xs ${item.isVoided ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                        ₹{(item.isVoided ? 0 : item.subtotal || item.price * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>

                {round.specialInstructions && (
                  <div className="pt-1.5 border-t border-slate-100 text-[10px] text-slate-500 italic">
                    Instructions: {round.specialInstructions}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Financial Summary */}
        <div className="p-4 border-t border-slate-200 bg-white space-y-3">
          <div className="space-y-1 text-xs font-mono">
            <div className="flex justify-between text-slate-500">
              <span>Subtotal:</span>
              <span>₹{guestSession.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Dining Tax:</span>
              <span>₹{guestSession.tax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold text-slate-900 pt-1.5 border-t border-slate-100 text-sm">
              <span>Folio Balance:</span>
              <span className="text-blue-700 font-bold">₹{guestSession.totalAmount.toFixed(2)}</span>
            </div>
          </div>

          <div className="pt-1">
            <InvoiceDownloadButton
              session={guestSession}
              variant="secondary"
              label="Download Itemized PDF Folio"
              className="w-full"
            />
          </div>

          <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-400">
            <CreditCard className="w-3 h-3" />
            <span>Charged to room folio at checkout</span>
          </div>
        </div>
      </div>
    </div>
  )
}
