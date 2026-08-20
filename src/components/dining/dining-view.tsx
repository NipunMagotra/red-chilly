'use client'

import { useEffect } from 'react'
import {
  LogOut,
  Receipt,
  Hotel,
  ShieldCheck,
  User,
} from 'lucide-react'
import { GuestTabSession, MenuItemRecord } from '@/lib/data/restaurant-data'
import { useDineScanStore } from '@/lib/store/useStore'
import { logoutGuestSession } from '@/actions/auth-actions'
import { createClient } from '@/lib/supabase/client'
import { MenuCatalog } from './menu-catalog'
import { ContinuousTabBar } from './continuous-tab-bar'
import { TabDetailsDrawer } from './tab-details-drawer'
import { CartSheet } from './cart-sheet'

interface DiningViewProps {
  initialSession: GuestTabSession
  menuItems: MenuItemRecord[]
  sessionToken?: string
}

export function DiningView({ initialSession, menuItems, sessionToken }: DiningViewProps) {
  const {
    guestSession,
    setSession,
    setTabDrawerOpen,
    clearCart,
  } = useDineScanStore()

  useEffect(() => {
    setSession(initialSession)
  }, [initialSession, setSession])

  const currentSession = guestSession || initialSession

  // Realtime subscription: Authenticated via custom JWT for RLS evaluation
  useEffect(() => {
    if (!currentSession?.id) return

    try {
      const supabase = createClient()

      if (sessionToken) {
        supabase.realtime.setAuth(sessionToken)
      }

      const channel = supabase
        .channel(`guest-session-${currentSession.id}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'guest_sessions',
            filter: `id=eq.${currentSession.id}`,
          },
          (payload) => {
            const updated = payload.new as Partial<GuestTabSession>
            if (updated && (updated.status === 'settled' || updated.status === 'closed')) {
              clearCart()
              setSession({
                ...currentSession,
                ...updated,
                status: updated.status as 'settled' | 'closed',
              })
              setTabDrawerOpen(true)
            }
          }
        )
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    } catch {
      // Graceful fallback if Supabase client is unconfigured in offline mock mode
    }
  }, [currentSession.id, sessionToken, clearCart, setSession, setTabDrawerOpen, currentSession])

  const handleLogout = async () => {
    await logoutGuestSession()
    window.location.reload()
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center">
      {/* Top Header */}
      <header className="sticky top-0 z-30 w-full border-b border-slate-800 bg-slate-950">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-300">
              <Hotel className="w-3.5 h-3.5" />
            </div>
            <div>
              <h1 className="font-semibold text-xs text-slate-100 leading-tight">
                {currentSession.propertyName}
              </h1>
              <p className="text-[10px] text-slate-400 font-mono">
                {currentSession.locationName} &bull; {currentSession.guestName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setTabDrawerOpen(true)}
              className="px-2.5 py-1 rounded-md bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-mono text-slate-200 flex items-center gap-1.5 cursor-pointer"
            >
              <Receipt className="w-3.5 h-3.5 text-slate-400" />
              <span>₹{currentSession.totalAmount.toFixed(2)}</span>
            </button>

            <button
              onClick={handleLogout}
              title="Lock Screen"
              className="p-1.5 rounded-md bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="w-full max-w-5xl mx-auto px-4 pt-5 pb-24 flex-1">
        {/* Unit & Status Bar */}
        <div className="mb-5 pb-3 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-mono">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Authenticated Session &bull; {currentSession.locationName}</span>
            </div>
            <h2 className="text-base font-semibold text-slate-100 mt-0.5">
              Dining &amp; Room Service Menu
            </h2>
          </div>

          <div className="text-xs text-slate-400 font-mono">
            Tab Balance: <span className="font-bold text-slate-100">₹{currentSession.totalAmount.toFixed(2)}</span>
          </div>
        </div>

        {/* Menu Catalog */}
        <MenuCatalog
          menuItems={menuItems}
          locationName={currentSession.locationName}
        />
      </main>

      {/* Floating Bottom Tab Bar */}
      <ContinuousTabBar />

      {/* Slide-over Drawers */}
      <TabDetailsDrawer />
      <CartSheet />
    </div>
  )
}
