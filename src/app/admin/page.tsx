'use client'

import { useState, useEffect, useTransition, useCallback } from 'react'
import Link from 'next/link'
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
  Loader2,
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
    const reason = prompt('Enter reason for voiding item:', 'Out of stock / kitchen void')
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

  // Clean Loading State
  if (isStaffAuthed === null && isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col items-center justify-center gap-2">
        <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
        <span className="text-xs text-slate-400 font-mono">Loading console...</span>
      </div>
    )
  }

  // Staff Login Screen
  if (!isStaffAuthed) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-md p-6 text-left">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-800">
            <Lock className="w-4 h-4 text-slate-400" />
            <h1 className="text-sm font-semibold text-slate-100">Reception Console Login</h1>
          </div>

          <p className="text-xs text-slate-400 mb-4">
            Enter staff passcode to access stay PIN management, tabs, and folios.
          </p>

          <form onSubmit={handleStaffLogin} className="space-y-3">
            <div>
              <label className="text-xs text-slate-400 block mb-1">
                Passcode
              </label>
              <input
                type="password"
                required
                value={staffPasscode}
                onChange={(e) => setStaffPasscode(e.target.value)}
                placeholder="Enter passcode..."
                className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-slate-600"
              />
            </div>

            {loginError && (
              <div className="p-2.5 rounded-md bg-red-950/40 border border-red-900 text-xs text-red-400 flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-2 rounded-md bg-slate-100 text-slate-950 hover:bg-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isLoggingIn ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>

          <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500 font-mono">
            <span>Passcode: redchilly2026</span>
            <Link href="/" className="text-slate-400 hover:text-slate-200">
              &larr; Guest Hub
            </Link>
          </div>
        </div>
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
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-5">
        {/* Header Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-300">
              <Hotel className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-semibold text-slate-100">
                  Reception &amp; Front Desk Console
                </h1>
                <span className="text-[10px] font-mono text-emerald-400 border border-emerald-900/60 bg-emerald-950/40 px-1.5 py-0.5 rounded">
                  LIVE
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Red Chilly Resort &bull; Continuous Tabs &amp; Guest Folios
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadDashboard}
              className="px-2.5 py-1.5 rounded-md bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs flex items-center gap-1.5 cursor-pointer"
              title="Refresh Data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <button
              onClick={() => {
                setCheckInSuccessSlip(null)
                setCheckInLocation(data?.locations[0]?.qrCodeIdentifier || '')
                setCheckInGuestName('')
                generateRandomPin()
                setIsCheckInOpen(true)
              }}
              className="px-3 py-1.5 rounded-md bg-slate-100 text-slate-950 hover:bg-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Check-In Guest</span>
            </button>

            <button
              onClick={handleStaffLogout}
              className="px-2.5 py-1.5 rounded-md bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 text-xs flex items-center gap-1.5 cursor-pointer"
              title="Logout"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>

        {/* Dense Metrics Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-slate-900 border border-slate-800 rounded-md p-3">
            <span className="text-[11px] text-slate-400 block font-medium">Active Tab Revenue</span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-lg font-mono font-bold text-slate-100">
                ₹{data?.metrics.totalActiveRevenue.toFixed(2) || '0.00'}
              </span>
            </div>
            <span className="text-[10px] text-emerald-400 block mt-0.5">
              Live running tabs
            </span>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-md p-3">
            <span className="text-[11px] text-slate-400 block font-medium">Active Guest Tabs</span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-lg font-mono font-bold text-slate-100">
                {data?.metrics.activeTabsCount || 0}
              </span>
            </div>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              Across {data?.metrics.totalLocationsCount || 0} units
            </span>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-md p-3">
            <span className="text-[11px] text-slate-400 block font-medium">Settled Revenue</span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-lg font-mono font-bold text-slate-100">
                ₹{data?.metrics.totalSettledRevenue.toFixed(2) || '0.00'}
              </span>
            </div>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              {data?.metrics.settledTabsCount || 0} invoices closed
            </span>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-md p-3">
            <span className="text-[11px] text-slate-400 block font-medium">Order Rounds</span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-lg font-mono font-bold text-slate-100">
                {data?.metrics.totalRoundsCount || 0}
              </span>
            </div>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              Total kitchen rounds
            </span>
          </div>
        </div>

        {/* View Switcher & Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-1 border-b border-slate-800 sm:border-0 pb-2 sm:pb-0">
            <button
              onClick={() => setActiveView('active')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                activeView === 'active'
                  ? 'bg-slate-800 text-slate-100'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Active Tabs ({data?.activeTabs.length || 0})
            </button>
            <button
              onClick={() => setActiveView('rooms')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                activeView === 'rooms'
                  ? 'bg-slate-800 text-slate-100'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Rooms &amp; PINs ({data?.locations.length || 0})
            </button>
            <button
              onClick={() => setActiveView('settled')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                activeView === 'settled'
                  ? 'bg-slate-800 text-slate-100'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Settled Folios ({data?.settledTabs.length || 0})
            </button>
          </div>

          <div className="relative max-w-xs w-full">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by room, guest, or PIN..."
              className="w-full bg-slate-900 border border-slate-800 rounded-md pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-slate-700"
            />
          </div>
        </div>

        {/* View 1: Active Tabs Table */}
        {activeView === 'active' && (
          <div className="bg-slate-900 border border-slate-800 rounded-md overflow-hidden">
            <div className="px-4 py-2.5 border-b border-slate-800 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-200">
                Active Continuous Tabs
              </span>
              <span className="text-[11px] font-mono text-slate-400">
                {filteredActiveTabs.length} active
              </span>
            </div>

            {filteredActiveTabs.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                No active continuous tabs found.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 font-mono text-[11px] border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">Room / Station</th>
                      <th className="py-2.5 px-3">Guest Name</th>
                      <th className="py-2.5 px-3">Stay PIN</th>
                      <th className="py-2.5 px-3">Rounds / Items</th>
                      <th className="py-2.5 px-3">Total Balance</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredActiveTabs.map((session) => (
                      <tr key={session.id} className="hover:bg-slate-800/30">
                        <td className="py-2.5 px-3">
                          <span className="font-semibold text-slate-100 block">
                            {session.locationName}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            /{session.locationType}/{session.locationIdentifier}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-300">
                          {session.guestName}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-semibold text-slate-200">
                          {session.stayPin}
                        </td>
                        <td className="py-2.5 px-3 text-slate-400 font-mono">
                          {session.rounds.length} rnd &bull; {session.totalItemsCount} itm
                        </td>
                        <td className="py-2.5 px-3 font-mono">
                          <span className="font-bold text-slate-100 block">
                            ₹{session.totalAmount.toFixed(2)}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            Sub ₹{session.subtotal.toFixed(2)} | Tax ₹{session.tax.toFixed(2)}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right space-x-2">
                          <button
                            onClick={() => {
                              setSettleSession(session)
                              setSettleSuccess(false)
                              setStaffNote('')
                            }}
                            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium cursor-pointer"
                          >
                            Checkout &amp; Settle
                          </button>
                          <InvoiceDownloadButton
                            session={session}
                            variant="secondary"
                            label="Folio PDF"
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

        {/* View 2: Rooms & PIN Management */}
        {activeView === 'rooms' && (
          <div className="bg-slate-900 border border-slate-800 rounded-md overflow-hidden">
            <div className="px-4 py-2.5 border-b border-slate-800 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-200">
                Room Keys &amp; Stay PINs
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 font-mono text-[11px] border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Location Name</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">QR Identifier</th>
                    <th className="py-2.5 px-3">Stay PIN</th>
                    <th className="py-2.5 px-3">Assigned Guest</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredLocations.map((loc) => (
                    <tr key={loc.id} className="hover:bg-slate-800/30">
                      <td className="py-2.5 px-3 font-semibold text-slate-100">
                        {loc.name}
                      </td>
                      <td className="py-2.5 px-3 uppercase text-[10px] text-slate-400 font-mono">
                        {loc.locationType}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-400 text-xs">
                        {loc.qrCodeIdentifier}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-200">
                        {loc.accessPin}
                      </td>
                      <td className="py-2.5 px-3 text-slate-300">
                        {loc.guestName}
                      </td>
                      <td className="py-2.5 px-3 text-right space-x-2">
                        <button
                          onClick={() => {
                            setCheckInLocation(loc.qrCodeIdentifier)
                            setCheckInGuestName(loc.guestName)
                            generateRandomPin()
                            setCheckInSuccessSlip(null)
                            setIsCheckInOpen(true)
                          }}
                          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium cursor-pointer"
                        >
                          New PIN / Check-In
                        </button>
                        <Link
                          href={`/${loc.locationType === 'table' ? 'table' : 'room'}/${loc.qrCodeIdentifier}`}
                          target="_blank"
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs text-slate-300"
                        >
                          <span>Open</span>
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

        {/* View 3: Settled Invoices Table */}
        {activeView === 'settled' && (
          <div className="bg-slate-900 border border-slate-800 rounded-md overflow-hidden">
            <div className="px-4 py-2.5 border-b border-slate-800 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-200">
                Settled &amp; Archived Folios
              </span>
              <span className="text-[11px] font-mono text-slate-400">
                {filteredSettledTabs.length} closed
              </span>
            </div>

            {filteredSettledTabs.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                No settled folios yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 font-mono text-[11px] border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">Invoice #</th>
                      <th className="py-2.5 px-3">Location</th>
                      <th className="py-2.5 px-3">Guest Name</th>
                      <th className="py-2.5 px-3">Payment Method</th>
                      <th className="py-2.5 px-3">Final Amount</th>
                      <th className="py-2.5 px-3">Settled At</th>
                      <th className="py-2.5 px-3 text-right">PDF Invoice</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredSettledTabs.map((session) => (
                      <tr key={session.id} className="hover:bg-slate-800/30">
                        <td className="py-2.5 px-3 font-mono font-medium text-slate-300">
                          {session.invoiceNumber || 'INV-SETTLED'}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-slate-100">
                          {session.locationName}
                        </td>
                        <td className="py-2.5 px-3 text-slate-300">
                          {session.guestName}
                        </td>
                        <td className="py-2.5 px-3 capitalize text-slate-400 font-mono text-[11px]">
                          {session.paymentMethod?.replace('_', ' ') || 'Room Folio'}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-100">
                          ₹{session.totalAmount.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 text-slate-400 text-[11px]">
                          {session.settledAt
                            ? new Date(session.settledAt).toLocaleDateString() + ' ' + new Date(session.settledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            : new Date(session.updatedAt).toLocaleDateString()}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <InvoiceDownloadButton
                            session={session}
                            variant="secondary"
                            label="PDF"
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

      {/* Flat Check-In Modal */}
      {isCheckInOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-md p-5 text-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-slate-400" />
                <h3 className="font-semibold text-sm text-slate-100">Guest Check-In</h3>
              </div>
              <button
                onClick={() => setIsCheckInOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {checkInSuccessSlip ? (
              <div className="py-4 space-y-4 text-left text-xs">
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-md space-y-2">
                  <div className="flex justify-between border-b border-slate-800 pb-1.5 text-slate-400">
                    <span>Room / Station:</span>
                    <span className="font-semibold text-slate-100">{checkInSuccessSlip.location.name}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800 pb-1.5 text-slate-400">
                    <span>Guest Name:</span>
                    <span className="font-semibold text-slate-100">{checkInSuccessSlip.location.guestName}</span>
                  </div>
                  <div className="flex justify-between items-center pt-1">
                    <span className="text-slate-400">4-Digit Stay PIN:</span>
                    <span className="text-base font-mono font-bold text-slate-100">
                      {checkInSuccessSlip.location.accessPin}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(checkInSuccessSlip.location.accessPin || checkInPin || '')
                      alert('PIN copied to clipboard')
                    }}
                    className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs flex items-center gap-1"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy PIN</span>
                  </button>
                  <button
                    onClick={() => setIsCheckInOpen(false)}
                    className="px-3 py-1.5 rounded bg-slate-100 text-slate-950 hover:bg-white text-xs font-semibold cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCheckInSubmit} className="py-3 space-y-3 text-xs">
                <div>
                  <label className="text-slate-400 block mb-1">
                    Select Location
                  </label>
                  <select
                    value={checkInLocation}
                    onChange={(e) => setCheckInLocation(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-md p-2 text-xs text-slate-200 focus:outline-none"
                  >
                    {data?.locations.map((loc) => (
                      <option key={loc.id} value={loc.qrCodeIdentifier}>
                        {loc.name} ({loc.locationType}) &bull; PIN: {loc.accessPin}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">
                    Guest Name
                  </label>
                  <input
                    type="text"
                    required
                    value={checkInGuestName}
                    onChange={(e) => setCheckInGuestName(e.target.value)}
                    placeholder="e.g. Liam Davis"
                    className="w-full bg-slate-950 border border-slate-800 rounded-md p-2 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-slate-400">
                      Stay PIN
                    </label>
                    <button
                      type="button"
                      onClick={generateRandomPin}
                      className="text-slate-400 hover:text-slate-200 flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Randomize</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    maxLength={4}
                    required
                    value={checkInPin}
                    onChange={(e) => setCheckInPin(e.target.value)}
                    placeholder="4-digit PIN"
                    className="w-full bg-slate-950 border border-slate-800 rounded-md p-2 text-center font-mono font-bold text-sm text-slate-100 focus:outline-none"
                  />
                </div>

                <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsCheckInOpen(false)}
                    className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isPending}
                    className="px-3 py-1.5 rounded bg-slate-100 text-slate-950 hover:bg-white text-xs font-semibold cursor-pointer disabled:opacity-50"
                  >
                    {isPending ? 'Activating...' : 'Confirm Check-In'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Flat Settle & Checkout Modal */}
      {settleSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80">
          <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-md p-5 text-slate-100 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="font-semibold text-sm text-slate-100">
                  Settle Tab: {settleSession.locationName}
                </h3>
                <p className="text-xs text-slate-400">
                  Guest: {settleSession.guestName} &bull; PIN: {settleSession.stayPin}
                </p>
              </div>
              <button
                onClick={() => setSettleSession(null)}
                disabled={isSettling}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {settleSuccess ? (
              <div className="py-6 space-y-4 text-center text-xs">
                <div className="w-10 h-10 rounded-full bg-emerald-950/60 border border-emerald-900 flex items-center justify-center text-emerald-400 mx-auto">
                  <CheckCircle2 className="w-5 h-5" />
                </div>

                <div>
                  <h4 className="text-sm font-bold text-slate-100">Tab Settled &amp; Closed</h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Invoice #{settleSession.invoiceNumber} closed.
                  </p>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-md p-3 max-w-xs mx-auto space-y-1 font-mono text-left">
                  <div className="flex justify-between text-slate-400">
                    <span>Total Amount:</span>
                    <span className="font-bold text-slate-100">₹{settleSession.totalAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Payment:</span>
                    <span className="text-slate-200 capitalize">{settleSession.paymentMethod?.replace('_', ' ')}</span>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-2 pt-2">
                  <InvoiceDownloadButton
                    session={settleSession}
                    variant="primary"
                    label="Download PDF Invoice"
                  />
                  <button
                    onClick={() => setSettleSession(null)}
                    className="px-3 py-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto py-3 space-y-4 text-xs">
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-slate-300 block">
                    Order Rounds ({settleSession.rounds.length})
                  </span>

                  {settleSession.rounds.map((round) => (
                    <div
                      key={round.id}
                      className="bg-slate-950 border border-slate-800 rounded-md p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 font-mono text-[11px]">
                        <span className="text-slate-300 font-semibold">
                          Round #{round.roundNumber} &bull;{' '}
                          {new Date(round.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        <span className="text-slate-300">
                          ₹{round.total.toFixed(2)}
                        </span>
                      </div>

                      <div className="space-y-1.5">
                        {round.items.map((item) => (
                          <div
                            key={item.id}
                            className={`flex items-center justify-between p-1.5 rounded ${
                              item.isVoided
                                ? 'bg-red-950/20 text-slate-500'
                                : 'bg-slate-900/60'
                            }`}
                          >
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-slate-400">
                                {item.quantity}x
                              </span>
                              <span className={item.isVoided ? 'line-through text-slate-500' : 'text-slate-200'}>
                                {item.name}
                              </span>
                              {item.isVoided && (
                                <span className="text-[10px] text-red-400">
                                  (VOIDED)
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="font-mono text-slate-300">
                                ₹{(item.isVoided ? 0 : item.price * item.quantity).toFixed(2)}
                              </span>
                              {!item.isVoided && (
                                <button
                                  onClick={() => handleVoidItem(round.id, item.id)}
                                  className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-red-950 text-slate-400 hover:text-red-400 text-[10px]"
                                  title="Void item"
                                >
                                  Void
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Payment Selection */}
                <div className="bg-slate-950 border border-slate-800 rounded-md p-3 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-slate-400 block mb-1">
                        Payment Method
                      </label>
                      <select
                        value={paymentMethod}
                        onChange={(e) =>
                          setPaymentMethod(
                            e.target.value as 'room_folio' | 'credit_card' | 'cash'
                          )
                        }
                        className="w-full bg-slate-900 border border-slate-800 rounded-md p-2 text-xs text-slate-200 focus:outline-none"
                      >
                        <option value="room_folio">Room Folio</option>
                        <option value="credit_card">Credit / Debit Card</option>
                        <option value="cash">Cash</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-slate-400 block mb-1">
                        Staff Note
                      </label>
                      <input
                        type="text"
                        value={staffNote}
                        onChange={(e) => setStaffNote(e.target.value)}
                        placeholder="e.g. Settle at checkout"
                        className="w-full bg-slate-900 border border-slate-800 rounded-md p-2 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="border-t border-slate-800 pt-2 space-y-1 font-mono">
                    <div className="flex justify-between text-slate-400">
                      <span>Subtotal:</span>
                      <span>₹{settleSession.subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Tax (8.25%):</span>
                      <span>₹{settleSession.tax.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-slate-100 pt-1 border-t border-slate-800">
                      <span>Total Balance:</span>
                      <span className="text-sm">
                        ₹{settleSession.totalAmount.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setSettleSession(null)}
                    disabled={isSettling}
                    className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isSettling}
                    onClick={handleSettleTabSubmit}
                    className="px-4 py-1.5 rounded bg-slate-100 text-slate-950 hover:bg-white font-semibold text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>
                      {isSettling
                        ? 'Settling...'
                        : `Settle & Close (₹${settleSession.totalAmount.toFixed(2)})`}
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
