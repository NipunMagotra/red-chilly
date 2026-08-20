'use client'

import { useEffect } from 'react'
import {
  LogOut,
  Receipt,
  Flame,
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

      // Explicitly inject custom JWT to authenticate WebSocket connection
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
              // 1. Purge stale cart immediately
              clearCart()
              // 2. Update local session state
              setSession({
                ...currentSession,
                ...updated,
                status: updated.status as 'settled' | 'closed',
              })
              // 3. Open folio / settled view
              setTabDrawerOpen(true)
            }
          }
        )
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    } catch {
      // Graceful fallback if Supabase client is unconfigured or in offline mock mode
    }
  }, [currentSession.id, sessionToken, clearCart, setSession, setTabDrawerOpen, currentSession])

  const handleLogout = async () => {
    await logoutGuestSession()
    window.location.reload()
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center selection:bg-red-500 selection:text-white relative overflow-x-hidden">
      {/* Dynamic Ambient Background Glows */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-gradient-to-tr from-red-600/15 via-orange-500/10 to-purple-600/10 blur-[140px] rounded-full" />
      <div className="pointer-events-none absolute top-1/3 -right-40 w-[500px] h-[500px] bg-gradient-to-br from-red-600/10 to-amber-500/10 blur-[130px] rounded-full" />

      {/* Top Navbar */}
      <header className="sticky top-0 z-30 w-full border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Left: Resort / Property Title */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-red-600/20 border border-red-500/30 flex items-center justify-center text-red-400">
              <Flame className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <h1 className="font-bold text-sm sm:text-base text-white leading-tight">
                {currentSession.propertyName}
              </h1>
              <p className="text-[11px] text-slate-400 font-mono">
                {currentSession.locationName}
              </p>
            </div>
          </div>

          {/* Right: Guest Name, Tab Status & Logout */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs text-slate-300">
              <User className="w-3.5 h-3.5 text-red-400" />
              <span>{currentSession.guestName}</span>
            </div>

            <button
              onClick={handleLogout}
              title="Lock Session / Log Out"
              className="p-2 rounded-xl bg-slate-900 hover:bg-red-950/40 border border-slate-800 hover:border-red-500/30 text-slate-400 hover:text-red-300 transition-colors flex items-center gap-1.5 text-xs cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Lock Screen</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="w-full max-w-6xl mx-auto px-4 sm:px-6 pt-8 pb-32 flex-1">
        {/* Welcome Header */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-slate-800/80">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-red-400 uppercase tracking-widest">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Authenticated Session &bull; {currentSession.locationName}</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              In-Room Dining &amp; Bar
            </h2>
            <p className="text-slate-400 text-sm max-w-xl">
              Welcome, <strong>{currentSession.guestName}</strong>. All selections append seamlessly to your continuous room tab with live kitchen routing.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setTabDrawerOpen(true)}
              className="px-4 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-2 transition-colors cursor-pointer shadow-sm"
            >
              <Receipt className="w-4 h-4 text-red-400" />
              <span>
                Tab: <strong className="font-mono text-white">₹{currentSession.totalAmount.toFixed(2)}</strong>
              </span>
            </button>
          </div>
        </div>

        {/* Menu Catalog */}
        <MenuCatalog
          menuItems={menuItems}
          locationName={currentSession.locationName}
        />
      </main>

      {/* Floating Continuous Tab Bar */}
      <ContinuousTabBar />

      {/* Slide-over Drawers */}
      <TabDetailsDrawer />
      <CartSheet />
    </div>
  )
}
