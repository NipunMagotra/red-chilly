'use client'

import { useState, useEffect, useTransition, useCallback } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Hotel,
  Receipt,
  KeyRound,
  CheckCircle2,
  Plus,
  Search,
  IndianRupee,
  Clock,
  RefreshCw,
  FileText,
  X,
  CreditCard,
  Ban,
  Copy,
  ExternalLink,
  ShieldAlert,
  LogOut,
  Lock,
  ArrowRight,
} from 'lucide-react'
import {
  getAdminDashboardData,
  adminCheckInGuest,
  adminVoidItem,
  adminSettleTab,
  checkStaffAuth,
  staffLogin,
  staffLogout,
  AdminDashboardData,
} from '@/actions/admin-actions'
import { GuestTabSession, LocationRecord } from '@/lib/data/restaurant-data'
import { InvoiceDownloadButton } from '@/components/invoice/invoice-download-button'

export default function AdminConsolePage() {
  const [isStaffAuthed, setIsStaffAuthed] = useState<boolean | null>(null)
  const [staffPasscode, setStaffPasscode] = useState('')
  const [loginError, setLoginError] = useState<string | null>(null)
  const [isLoggingIn, setIsLoggingIn] = useState(false)

  const [data, setData] = useState<AdminDashboardData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [activeView, setActiveView] = useState<'active' | 'rooms' | 'settled'>('active')
  const [searchQuery, setSearchQuery] = useState('')

  // Check-In Modal State
  const [isCheckInOpen, setIsCheckInOpen] = useState(false)
  const [checkInLocation, setCheckInLocation] = useState('')
  const [checkInGuestName, setCheckInGuestName] = useState('')
  const [checkInPin, setCheckInPin] = useState('')
  const [checkInSuccessSlip, setCheckInSuccessSlip] = useState<{
    location: LocationRecord
    session: GuestTabSession
  } | null>(null)

  // Settle Tab Modal State
  const [settleSession, setSettleSession] = useState<GuestTabSession | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<'room_folio' | 'credit_card' | 'cash'>('room_folio')
  const [staffNote, setStaffNote] = useState('')
  const [isSettling, setIsSettling] = useState(false)
  const [settleSuccess, setSettleSuccess] = useState(false)

  const [isPending, startTransition] = useTransition()

  const loadDashboard = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await getAdminDashboardData()
      if (res.success && res.data) {
        setData(res.data)
      } else if (res.error?.includes('Unauthorized')) {
        setIsStaffAuthed(false)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    async function initAuth() {
      const auth = await checkStaffAuth()
      setIsStaffAuthed(auth.isAuthenticated)
      if (auth.isAuthenticated) {
        loadDashboard()
      } else {
        setIsLoading(false)
      }
    }
    initAuth()
  }, [loadDashboard])

  const handleStaffLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!staffPasscode) return

    setIsLoggingIn(true)
    setLoginError(null)

    try {
      const res = await staffLogin(staffPasscode)
      if (res.success) {
        setIsStaffAuthed(true)
        loadDashboard()
      } else {
        setLoginError(res.error || 'Access denied. Incorrect staff passcode.')
      }
    } catch {
      setLoginError('Login failed. Please check network connection.')
    } finally {
      setIsLoggingIn(false)
    }
  }

  const handleStaffLogout = async () => {
    await staffLogout()
    setIsStaffAuthed(false)
    setData(null)
  }

  const generateRandomPin = () => {
    const randomPin = Math.floor(1000 + Math.random() * 9000).toString()
    setCheckInPin(randomPin)
  }

  const handleCheckInSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!checkInLocation) return

    startTransition(async () => {
      const res = await adminCheckInGuest(
        checkInLocation,
        checkInGuestName,
        checkInPin
      )
      if (res.success && res.location && res.session) {
        setCheckInSuccessSlip({ location: res.location, session: res.session })
        loadDashboard()
      } else {
        alert(res.error || 'Failed to check in guest')
      }
    })
  }

  const handleVoidItem = async (roundId: string, itemId: string) => {
    if (!settleSession) return
    const reason = prompt('Enter reason for voiding item (e.g. Out of Stock):', 'Out of stock / kitchen void')
    if (!reason) return

    const res = await adminVoidItem(settleSession.id, roundId, itemId, reason)
    if (res.success && res.session) {
      setSettleSession(res.session)
      loadDashboard()
    }
  }

  const handleSettleTabSubmit = async () => {
    if (!settleSession) return
    setIsSettling(true)

    try {
      const res = await adminSettleTab(settleSession.id, paymentMethod, staffNote)
      if (res.success && res.session) {
        setSettleSession(res.session)
        setSettleSuccess(true)
        loadDashboard()
      } else {
        alert(res.error || 'Failed to settle tab')
      }
    } finally {
      setIsSettling(false)
    }
  }

  // If loading initial auth
  if (isStaffAuthed === null && isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-red-500 animate-spin" />
      </div>
    )
  }

  // Staff Login Challenge Screen if not authenticated
  if (!isStaffAuthed) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 selection:bg-red-500 selection:text-white relative overflow-hidden">
        <div className="pointer-events-none fixed -top-40 right-10 w-[600px] h-[500px] bg-red-600/15 blur-[150px] rounded-full" />
        <div className="pointer-events-none fixed bottom-10 left-10 w-[500px] h-[400px] bg-amber-500/10 blur-[140px] rounded-full" />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="relative z-10 w-full max-w-md bg-slate-900/90 border border-slate-800 backdrop-blur-xl rounded-3xl p-6 sm:p-8 shadow-2xl text-center"
        >
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-600/30 to-amber-500/20 border border-red-500/30 flex items-center justify-center text-red-400 mx-auto mb-4">
            <Lock className="w-8 h-8 text-red-500" />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-950/80 border border-red-500/30 text-red-400 text-xs font-semibold mb-2">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Staff Authentication Required</span>
          </div>

          <h1 className="text-2xl font-extrabold text-white tracking-tight">
            Front Desk &amp; Reception Console
          </h1>
          <p className="text-xs text-slate-400 mt-1 mb-6">
            Enter the authorized staff passcode to access stay PIN management, continuous tabs, and billing folios.
          </p>

          <form onSubmit={handleStaffLogin} className="space-y-4 text-left">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                Reception Admin Passcode
              </label>
              <input
                type="password"
                required
                value={staffPasscode}
                onChange={(e) => setStaffPasscode(e.target.value)}
                placeholder="Enter staff passcode..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-red-500/50"
              />
            </div>

            {loginError && (
              <div className="p-3 rounded-xl bg-red-950/60 border border-red-900 text-xs text-red-400">
                {loginError}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white font-bold text-sm shadow-lg shadow-red-950/50 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 transition-all"
            >
              {isLoggingIn ? (
                <span>Authenticating...</span>
              ) : (
                <>
                  <span>Unlock Reception Console</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
            <span>Default Passcode: <strong className="font-mono text-slate-300">redchilly2026</strong></span>
            <Link href="/" className="text-red-400 hover:text-red-300">
              &larr; Guest Hub
            </Link>
          </div>
        </motion.div>
      </div>
    )
  }

  const filteredActiveTabs = data?.activeTabs.filter(
    (t) =>
      t.locationName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.guestName.toLowerCase().includes(searchQuery.toLowerCase())
  ) || []

  const filteredLocations = data?.locations.filter(
    (l) =>
      l.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.guestName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.qrCodeIdentifier.toLowerCase().includes(searchQuery.toLowerCase())
  ) || []

  const filteredSettledTabs = data?.settledTabs.filter(
    (s) =>
      s.locationName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.guestName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.invoiceNumber && s.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()))
  ) || []

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-8 selection:bg-red-500 selection:text-white">
      {/* Ambient Glows */}
      <div className="pointer-events-none fixed -top-40 right-10 w-[600px] h-[500px] bg-red-600/10 blur-[150px] rounded-full" />
      <div className="pointer-events-none fixed bottom-10 left-10 w-[500px] h-[400px] bg-amber-500/10 blur-[140px] rounded-full" />

      <div className="relative z-10 max-w-7xl mx-auto space-y-8">
        {/* Top Reception Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-red-600/30 to-amber-500/20 border border-red-500/30 flex items-center justify-center text-red-400 shadow-inner">
              <Hotel className="w-6 h-6 text-red-500" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  Front Desk &amp; Reception Admin Console
                </h1>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-red-950/70 border border-red-500/30 text-red-400 font-semibold">
                  Authenticated
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Red Chilly Luxury Resort &bull; Live Guest Stay PINs, Continuous Tabs &amp; Invoicing
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={loadDashboard}
              className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
              title="Refresh Dashboard Data"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={() => {
                setCheckInSuccessSlip(null)
                setCheckInLocation(data?.locations[0]?.qrCodeIdentifier || '')
                setCheckInGuestName('')
                generateRandomPin()
                setIsCheckInOpen(true)
              }}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-red-950/50 flex items-center gap-2 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Check-In Guest &amp; Generate PIN</span>
            </button>

            <button
              onClick={handleStaffLogout}
              className="p-2.5 rounded-xl bg-slate-900 hover:bg-red-950/40 border border-slate-800 hover:border-red-500/30 text-slate-400 hover:text-red-300 transition-colors flex items-center gap-1.5 text-xs cursor-pointer"
              title="Log out of Reception"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>

        {/* Live KPI Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 backdrop-blur-sm">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Active Tabs Revenue</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <IndianRupee className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl sm:text-3xl font-extrabold font-mono text-white">
                ₹{data?.metrics.totalActiveRevenue.toFixed(2) || '0.00'}
              </span>
              <p className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                Live running continuous tabs
              </p>
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 backdrop-blur-sm">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Active Guest Tabs</span>
              <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
                <Receipt className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl sm:text-3xl font-extrabold font-mono text-white">
                {data?.metrics.activeTabsCount || 0}
              </span>
              <p className="text-[11px] text-slate-400 mt-1">
                Across {data?.metrics.totalLocationsCount || 0} rooms &amp; stations
              </p>
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 backdrop-blur-sm">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Settled Checkouts</span>
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl sm:text-3xl font-extrabold font-mono text-white">
                ₹{data?.metrics.totalSettledRevenue.toFixed(2) || '0.00'}
              </span>
              <p className="text-[11px] text-purple-400 mt-1">
                {data?.metrics.settledTabsCount || 0} invoices closed &amp; archived
              </p>
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 backdrop-blur-sm">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Kitchen Order Rounds</span>
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl sm:text-3xl font-extrabold font-mono text-white">
                {data?.metrics.totalRoundsCount || 0}
              </span>
              <p className="text-[11px] text-slate-400 mt-1">
                Total dining &amp; late-night rounds
              </p>
            </div>
          </div>
        </div>

        {/* View Selection & Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-2">
          {/* View Tabs */}
          <div className="flex items-center gap-2 p-1 bg-slate-900 border border-slate-800 rounded-2xl">
            <button
              onClick={() => setActiveView('active')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                activeView === 'active'
                  ? 'bg-red-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Active Tabs ({data?.activeTabs.length || 0})
            </button>
            <button
              onClick={() => setActiveView('rooms')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                activeView === 'rooms'
                  ? 'bg-red-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Rooms &amp; PINs ({data?.locations.length || 0})
            </button>
            <button
              onClick={() => setActiveView('settled')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                activeView === 'settled'
                  ? 'bg-red-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Settled Folios ({data?.settledTabs.length || 0})
            </button>
          </div>

          {/* Search Box */}
          <div className="relative max-w-xs w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search room, guest, or PIN..."
              className="w-full bg-slate-900 border border-slate-800 rounded-2xl pl-10 pr-4 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-red-500/50"
            />
          </div>
        </div>

        {/* View 1: Active Guest Tabs Table */}
        {activeView === 'active' && (
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl backdrop-blur-sm">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-white">Live Active Continuous Tabs</h3>
                <p className="text-xs text-slate-400">
                  Real-time balances for guest rooms and dining stations currently open.
                </p>
              </div>
              <span className="text-xs px-3 py-1 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-500/30 font-mono">
                {filteredActiveTabs.length} Active Sessions
              </span>
            </div>

            {filteredActiveTabs.length === 0 ? (
              <div className="p-12 text-center text-slate-500">
                <Receipt className="w-12 h-12 stroke-1 mx-auto mb-2 text-slate-600" />
                <p className="text-sm font-medium text-slate-400">No active continuous tabs found</p>
                <p className="text-xs text-slate-500 mt-1">
                  Check in a guest or simulate an order from the guest portal.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/60 text-slate-400 uppercase font-mono text-[10px] tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="p-4">Room / Station</th>
                      <th className="p-4">Guest Name</th>
                      <th className="p-4">Stay PIN</th>
                      <th className="p-4">Rounds &amp; Items</th>
                      <th className="p-4">Running Total</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {filteredActiveTabs.map((session) => (
                      <tr key={session.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="p-4">
                          <div className="font-bold text-white text-sm">
                            {session.locationName}
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono">
                            /{session.locationType}/{session.locationIdentifier}
                          </span>
                        </td>
                        <td className="p-4 font-medium text-slate-200">
                          {session.guestName}
                        </td>
                        <td className="p-4">
                          <span className="px-2.5 py-1 rounded-lg bg-amber-950/60 border border-amber-500/30 text-amber-300 font-mono font-bold text-xs">
                            {session.stayPin}
                          </span>
                        </td>
                        <td className="p-4 text-slate-300 font-mono">
                          {session.rounds.length} round(s) &bull; {session.totalItemsCount} item(s)
                        </td>
                        <td className="p-4">
                          <span className="font-mono text-base font-extrabold text-red-400">
                            ₹{session.totalAmount.toFixed(2)}
                          </span>
                          <div className="text-[10px] text-slate-500 font-mono">
                            Sub: ₹{session.subtotal.toFixed(2)} + Tax: ₹{session.tax.toFixed(2)}
                          </div>
                        </td>
                        <td className="p-4 text-right space-x-2">
                          <button
                            onClick={() => {
                              setSettleSession(session)
                              setSettleSuccess(false)
                              setStaffNote('')
                            }}
                            className="px-3 py-1.5 rounded-xl bg-red-600/90 hover:bg-red-600 text-white font-semibold text-xs transition-colors cursor-pointer shadow-sm"
                          >
                            Checkout &amp; Settle Tab
                          </button>
                          <InvoiceDownloadButton
                            session={session}
                            variant="secondary"
                            label="Invoice PDF"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* View 2: All Rooms & PIN Management */}
        {activeView === 'rooms' && (
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl backdrop-blur-sm">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-white">Room Key &amp; PIN Management</h3>
                <p className="text-xs text-slate-400">
                  Manage 4-digit stay access codes and check in arriving guests.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/60 text-slate-400 uppercase font-mono text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="p-4">Location Name</th>
                    <th className="p-4">Type</th>
                    <th className="p-4">QR Slug</th>
                    <th className="p-4">Current Stay PIN</th>
                    <th className="p-4">Assigned Guest</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {filteredLocations.map((loc) => (
                    <tr key={loc.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-4 font-bold text-white text-sm">
                        {loc.name}
                      </td>
                      <td className="p-4">
                        <span className="uppercase text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                          {loc.locationType}
                        </span>
                      </td>
                      <td className="p-4 font-mono text-slate-400 text-xs">
                        {loc.qrCodeIdentifier}
                      </td>
                      <td className="p-4">
                        <span className="px-3 py-1 rounded-lg bg-red-950/60 border border-red-500/30 text-amber-300 font-mono font-bold text-sm">
                          {loc.accessPin}
                        </span>
                      </td>
                      <td className="p-4 font-medium text-slate-200">
                        {loc.guestName}
                      </td>
                      <td className="p-4 text-right space-x-2">
                        <button
                          onClick={() => {
                            setCheckInLocation(loc.qrCodeIdentifier)
                            setCheckInGuestName(loc.guestName)
                            generateRandomPin()
                            setCheckInSuccessSlip(null)
                            setIsCheckInOpen(true)
                          }}
                          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold text-xs transition-colors cursor-pointer"
                        >
                          Check-In / New PIN
                        </button>
                        <Link
                          href={`/${loc.locationType === 'table' ? 'table' : 'room'}/${loc.qrCodeIdentifier}`}
                          target="_blank"
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 hover:text-white"
                        >
                          <span>Open Menu</span>
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* View 3: Settled Folios History */}
        {activeView === 'settled' && (
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl backdrop-blur-sm">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-white">Settled &amp; Closed Invoices</h3>
                <p className="text-xs text-slate-400">
                  Archived dining folios charged to room or settled at reception.
                </p>
              </div>
              <span className="text-xs px-3 py-1 rounded-full bg-purple-950/80 text-purple-400 border border-purple-500/30 font-mono">
                {filteredSettledTabs.length} Settled Invoices
              </span>
            </div>

            {filteredSettledTabs.length === 0 ? (
              <div className="p-12 text-center text-slate-500">
                <FileText className="w-12 h-12 stroke-1 mx-auto mb-2 text-slate-600" />
                <p className="text-sm font-medium text-slate-400">No settled folios yet</p>
                <p className="text-xs text-slate-500 mt-1">
                  Completed checkouts will automatically appear here with downloadable PDFs.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/60 text-slate-400 uppercase font-mono text-[10px] tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="p-4">Invoice #</th>
                      <th className="p-4">Room / Station</th>
                      <th className="p-4">Guest Name</th>
                      <th className="p-4">Payment Method</th>
                      <th className="p-4">Final Amount</th>
                      <th className="p-4">Settled At</th>
                      <th className="p-4 text-right">PDF Invoice</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {filteredSettledTabs.map((session) => (
                      <tr key={session.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="p-4 font-mono font-bold text-red-400">
                          {session.invoiceNumber || 'INV-SETTLED'}
                        </td>
                        <td className="p-4 font-semibold text-white">
                          {session.locationName}
                        </td>
                        <td className="p-4 text-slate-300">
                          {session.guestName}
                        </td>
                        <td className="p-4">
                          <span className="capitalize px-2 py-0.5 rounded bg-emerald-950/70 text-emerald-300 border border-emerald-500/30 text-[10px] font-semibold">
                            {session.paymentMethod?.replace('_', ' ') || 'Room Folio'}
                          </span>
                        </td>
                        <td className="p-4 font-mono font-bold text-sm text-white">
                          ₹{session.totalAmount.toFixed(2)}
                        </td>
                        <td className="p-4 text-slate-400 text-[11px]">
                          {session.settledAt
                            ? new Date(session.settledAt).toLocaleString()
                            : new Date(session.updatedAt).toLocaleString()}
                        </td>
                        <td className="p-4 text-right">
                          <InvoiceDownloadButton
                            session={session}
                            variant="primary"
                            label="Download PDF"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Check-In Guest Modal */}
      <AnimatePresence>
        {isCheckInOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCheckInOpen(false)}
              className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm"
            />

            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative z-10 w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl text-slate-100"
            >
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-red-600/20 border border-red-500/30 flex items-center justify-center text-red-400">
                    <KeyRound className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-white">Guest Check-In</h3>
                    <p className="text-xs text-slate-400">Generate 4-digit Stay PIN &amp; Activate Tab</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsCheckInOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {checkInSuccessSlip ? (
                /* Welcome Slip view */
                <div className="py-6 space-y-6 text-center">
                  <div className="w-14 h-14 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 mx-auto">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>

                  <div>
                    <h4 className="text-xl font-bold text-white">Check-In Successful!</h4>
                    <p className="text-xs text-slate-400 mt-1">
                      Room tab activated with secure 4-digit stay access code.
                    </p>
                  </div>

                  {/* Printable Slip Card */}
                  <div className="bg-slate-950 border border-red-500/40 rounded-2xl p-5 text-left space-y-3 shadow-inner">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <span className="text-xs text-red-400 font-bold uppercase tracking-wider">
                        Room Welcome Slip
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        Red Chilly Resort
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-slate-500 text-[10px] uppercase">Room / Station</span>
                        <p className="font-bold text-white">{checkInSuccessSlip.location.name}</p>
                      </div>
                      <div>
                        <span className="text-slate-500 text-[10px] uppercase">Guest Name</span>
                        <p className="font-bold text-white">{checkInSuccessSlip.location.guestName}</p>
                      </div>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-semibold">
                          4-Digit Stay PIN
                        </span>
                        <p className="text-2xl font-black font-mono text-amber-400 tracking-widest">
                          {checkInSuccessSlip.location.accessPin}
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(checkInSuccessSlip.location.accessPin || checkInPin || '')
                          alert('PIN copied to clipboard!')
                        }}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy PIN</span>
                      </button>
                    </div>

                    <p className="text-[11px] text-slate-400 italic">
                      Scan the room QR code or visit <strong>dinescan.fyi</strong> and enter PIN <strong>{checkInSuccessSlip.location.accessPin}</strong>.
                    </p>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      onClick={() => setIsCheckInOpen(false)}
                      className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs cursor-pointer"
                    >
                      Done
                    </button>
                    <Link
                      href={`/${checkInSuccessSlip.location.locationType === 'table' ? 'table' : 'room'}/${checkInSuccessSlip.location.qrCodeIdentifier}`}
                      target="_blank"
                      className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-lg shadow-red-950/40"
                    >
                      <span>Open Room Menu</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              ) : (
                /* Form view */
                <form onSubmit={handleCheckInSubmit} className="py-6 space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                      Select Room / Station
                    </label>
                    <select
                      value={checkInLocation}
                      onChange={(e) => setCheckInLocation(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-red-500/50"
                    >
                      {data?.locations.map((loc) => (
                        <option key={loc.id} value={loc.qrCodeIdentifier}>
                          {loc.name} ({loc.locationType}) &bull; Currently PIN: {loc.accessPin}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                      Guest Name
                    </label>
                    <input
                      type="text"
                      required
                      value={checkInGuestName}
                      onChange={(e) => setCheckInGuestName(e.target.value)}
                      placeholder="e.g. Liam &amp; Chloe Davis"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-red-500/50"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-semibold text-slate-300">
                        4-Digit Stay PIN
                      </label>
                      <button
                        type="button"
                        onClick={generateRandomPin}
                        className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 cursor-pointer"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Generate Random</span>
                      </button>
                    </div>
                    <input
                      type="text"
                      maxLength={4}
                      required
                      value={checkInPin}
                      onChange={(e) => setCheckInPin(e.target.value)}
                      placeholder="4-digit PIN"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-lg font-mono font-bold text-amber-400 tracking-widest focus:outline-none focus:border-red-500/50 text-center"
                    />
                  </div>

                  <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => setIsCheckInOpen(false)}
                      className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isPending}
                      className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white text-xs font-bold shadow-lg shadow-red-950/50 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {isPending ? 'Activating...' : 'Complete Check-In & Generate PIN'}
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Settle Tab & Checkout Modal */}
      <AnimatePresence>
        {settleSession && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isSettling && setSettleSession(null)}
              className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm"
            />

            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative z-10 w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl text-slate-100 max-h-[90vh] flex flex-col"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-red-600/20 border border-red-500/30 flex items-center justify-center text-red-400">
                    <Receipt className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-white">
                      Checkout &amp; Settle Tab: {settleSession.locationName}
                    </h3>
                    <p className="text-xs text-slate-400">
                      Guest: {settleSession.guestName} &bull; PIN: {settleSession.stayPin}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSettleSession(null)}
                  disabled={isSettling}
                  className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {settleSuccess ? (
                /* Success Checkout View with PDF Download */
                <div className="py-8 space-y-6 text-center">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 mx-auto">
                    <CheckCircle2 className="w-10 h-10" />
                  </div>

                  <div>
                    <h4 className="text-2xl font-bold text-white">Tab Settled &amp; Closed!</h4>
                    <p className="text-xs text-slate-400 mt-1">
                      Invoice #{settleSession.invoiceNumber} has been finalized and charged to {settleSession.paymentMethod?.replace('_', ' ')}.
                    </p>
                  </div>

                  <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 max-w-md mx-auto space-y-2 text-xs font-mono">
                    <div className="flex justify-between text-slate-400">
                      <span>Total Settled Amount</span>
                      <span className="text-base font-bold text-white">
                        ₹{settleSession.totalAmount.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Payment Method</span>
                      <span className="text-emerald-400 font-semibold uppercase">
                        {settleSession.paymentMethod?.replace('_', ' ')}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-center gap-3 pt-4">
                    <InvoiceDownloadButton
                      session={settleSession}
                      variant="primary"
                      label="Download Certified PDF Invoice"
                      className="text-sm px-6 py-3"
                    />
                    <button
                      onClick={() => setSettleSession(null)}
                      className="px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs cursor-pointer"
                    >
                      Close
                    </button>
                  </div>
                </div>
              ) : (
                /* Item Review & Voiding View */
                <div className="flex-1 overflow-y-auto py-4 space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                        Order Rounds Review ({settleSession.rounds.length} rounds)
                      </span>
                      <span className="text-[11px] text-slate-400">
                        Click &quot;Void&quot; to cancel out-of-stock items
                      </span>
                    </div>

                    {settleSession.rounds.map((round) => (
                      <div
                        key={round.id}
                        className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3"
                      >
                        <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                          <span className="font-mono text-xs font-bold text-red-400">
                            Round #{round.roundNumber} &bull;{' '}
                            {new Date(round.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          <span className="font-mono text-xs text-slate-300">
                            Round Total: ₹{round.total.toFixed(2)}
                          </span>
                        </div>

                        <div className="space-y-2">
                          {round.items.map((item) => (
                            <div
                              key={item.id}
                              className={`flex items-center justify-between text-xs p-2 rounded-xl ${
                                item.isVoided
                                  ? 'bg-red-950/30 border border-red-900/40 opacity-60'
                                  : 'bg-slate-900/60 border border-slate-800'
                              }`}
                            >
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-white font-mono">
                                    {item.quantity}x
                                  </span>
                                  <span className={item.isVoided ? 'line-through text-slate-400' : 'text-white font-medium'}>
                                    {item.name}
                                  </span>
                                </div>
                                {item.isVoided && (
                                  <span className="text-[10px] text-red-400 italic">
                                    VOIDED: {item.voidReason || 'Out of stock'}
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-3">
                                <span className="font-mono font-bold text-slate-300">
                                  ₹{(item.isVoided ? 0 : item.price * item.quantity).toFixed(2)}
                                </span>
                                {!item.isVoided && (
                                  <button
                                    onClick={() => handleVoidItem(round.id, item.id)}
                                    className="px-2 py-1 rounded-lg bg-red-950 hover:bg-red-900 border border-red-800 text-red-300 text-[10px] font-semibold flex items-center gap-1"
                                    title="Void item from tab"
                                  >
                                    <Ban className="w-3 h-3" />
                                    <span>Void</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Payment Method & Checkout Options */}
                  <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                          Payment Method
                        </label>
                        <select
                          value={paymentMethod}
                          onChange={(e) =>
                            setPaymentMethod(
                              e.target.value as 'room_folio' | 'credit_card' | 'cash'
                            )
                          }
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none focus:border-red-500/50"
                        >
                          <option value="room_folio">Charge to Room Folio</option>
                          <option value="credit_card">Credit / Debit Card</option>
                          <option value="cash">Cash Settlement</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                          Reception Staff Note
                        </label>
                        <input
                          type="text"
                          value={staffNote}
                          onChange={(e) => setStaffNote(e.target.value)}
                          placeholder="e.g. Settle at checkout / Folio #8934"
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-red-500/50"
                        />
                      </div>
                    </div>

                    {/* Financial Reconciliation Summary */}
                    <div className="border-t border-slate-800/80 pt-3 space-y-1 text-xs font-mono">
                      <div className="flex justify-between text-slate-400">
                        <span>Net Subtotal</span>
                        <span>₹{settleSession.subtotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Room Service Tax (8.25%)</span>
                        <span>₹{settleSession.tax.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-base font-bold text-white pt-2 border-t border-slate-800">
                        <span>Final Settle Balance</span>
                        <span className="text-red-400 text-lg">
                          ₹{settleSession.totalAmount.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Settle Action */}
                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setSettleSession(null)}
                      disabled={isSettling}
                      className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={isSettling}
                      onClick={handleSettleTabSubmit}
                      className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-red-950/50 cursor-pointer disabled:opacity-50"
                    >
                      <CreditCard className="w-4 h-4" />
                      <span>
                        {isSettling
                          ? 'Settling Tab...'
                          : `Settle Tab & Close (₹${settleSession.totalAmount.toFixed(2)})`}
                      </span>
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
