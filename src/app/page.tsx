'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  QrCode,
  CheckCircle2,
  FileText,
  ArrowRight,
  BookOpen,
  Sparkles,
} from 'lucide-react'
import {
  RestaurantClocheIcon,
  FoodMealIcon,
  HotelBuildingIcon,
  DiningCutleryIcon,
  CocktailGlassIcon,
  RoomKeyCardIcon,
} from '@/components/ui/hospitality-icons'
import { TutorialModal } from '@/components/tutorial/tutorial-modal'

export default function Home() {
  const router = useRouter()
  const [unitCode, setUnitCode] = useState('')
  const [unitType, setUnitType] = useState<'room' | 'table'>('room')
  const [errorMessage, setErrorMessage] = useState('')
  const [isTutorialOpen, setIsTutorialOpen] = useState(false)

  const handleNavigate = (e: React.FormEvent) => {
    e.preventDefault()
    const cleanCode = unitCode.trim().toLowerCase()
    if (!cleanCode) {
      setErrorMessage('Please enter a room or table identifier.')
      return
    }

    setErrorMessage('')
    let target = cleanCode
    if (unitType === 'room' && !target.startsWith('room-') && !target.startsWith('cabana-')) {
      target = `room-${target}`
    } else if (unitType === 'table' && !target.startsWith('table-')) {
      target = `table-${target}`
    }

    const route = unitType === 'table' ? `/table/${target}` : `/room/${target}`
    router.push(route)
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col items-center justify-between p-4 sm:p-8">
      <div className="max-w-4xl w-full space-y-8 my-auto py-6">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-slate-500 font-semibold tracking-wider">DINESCAN</span>
              <span className="text-slate-300">&bull;</span>
              <span className="text-xs font-mono text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded font-semibold flex items-center gap-1">
                <RestaurantClocheIcon className="w-3 h-3 text-rose-600 inline" />
                <span>RED CHILLY</span>
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-2 tracking-tight">
              Smart Dining &amp; Continuous Tab Platform
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Seamless in-room &amp; table dining with 4-digit stay PIN security and instant folio billing.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setIsTutorialOpen(true)}
              className="px-3.5 py-2 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-2 transition-all shadow-xs cursor-pointer hover:border-slate-300"
            >
              <BookOpen className="w-4 h-4 text-rose-600" />
              <span>How It Works</span>
            </button>

            <Link
              href="/admin"
              className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-2 transition-all shadow-sm hover:shadow"
            >
              <HotelBuildingIcon className="w-4 h-4 text-slate-300" />
              <span>Reception Console</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Minimal Hospitality Service Showcase Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-slate-200/80 shadow-2xs">
            <div className="w-7 h-7 rounded-md bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
              <HotelBuildingIcon className="w-3.5 h-3.5" />
            </div>
            <div className="text-left">
              <span className="block text-[11px] font-semibold text-slate-800">Hotel Suites</span>
              <span className="block text-[10px] text-slate-400 font-mono">In-Room Service</span>
            </div>
          </div>

          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-slate-200/80 shadow-2xs">
            <div className="w-7 h-7 rounded-md bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shrink-0">
              <RestaurantClocheIcon className="w-3.5 h-3.5" />
            </div>
            <div className="text-left">
              <span className="block text-[11px] font-semibold text-slate-800">Restaurant Dining</span>
              <span className="block text-[10px] text-slate-400 font-mono">Terrace &amp; Tables</span>
            </div>
          </div>

          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-slate-200/80 shadow-2xs">
            <div className="w-7 h-7 rounded-md bg-orange-50 border border-orange-100 flex items-center justify-center text-orange-600 shrink-0">
              <FoodMealIcon className="w-3.5 h-3.5" />
            </div>
            <div className="text-left">
              <span className="block text-[11px] font-semibold text-slate-800">Gourmet Meals</span>
              <span className="block text-[10px] text-slate-400 font-mono">Fresh Preparation</span>
            </div>
          </div>

          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-slate-200/80 shadow-2xs">
            <div className="w-7 h-7 rounded-md bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 shrink-0">
              <CocktailGlassIcon className="w-3.5 h-3.5" />
            </div>
            <div className="text-left">
              <span className="block text-[11px] font-semibold text-slate-800">Beverage Lounge</span>
              <span className="block text-[10px] text-slate-400 font-mono">Poolside Cabanas</span>
            </div>
          </div>
        </div>

        {/* Quick Tutorial Callout Banner */}
        <div
          onClick={() => setIsTutorialOpen(true)}
          className="p-3 bg-gradient-to-r from-rose-50 to-orange-50/50 border border-rose-200/80 rounded-xl flex items-center justify-between gap-3 cursor-pointer hover:border-rose-300 transition-all shadow-2xs group"
        >
          <div className="flex items-center gap-2.5">
            <span className="w-7 h-7 rounded-lg bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
              <Sparkles className="w-3.5 h-3.5" />
            </span>
            <div className="text-xs">
              <span className="font-semibold text-slate-900">New to DineScan? </span>
              <span className="text-slate-600">Click to view the 60-second interactive guide on check-in, guest PINs, and continuous tabs.</span>
            </div>
          </div>
          <span className="text-xs text-rose-700 font-semibold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform shrink-0">
            <span>View Guide</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </span>
        </div>

        {/* Main Action Hub */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Guest In-Room / Table Dining Entry */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col justify-between space-y-6">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-lg bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
                <FoodMealIcon className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Guest Dining Portal
                </h2>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Enter your room or table code to view the menu and append orders to your continuous stay tab.
                </p>
              </div>
            </div>

            <form onSubmit={handleNavigate} className="space-y-3">
              <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setUnitType('room')}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all flex items-center justify-center gap-1.5 ${
                    unitType === 'room'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <HotelBuildingIcon className="w-3 h-3 text-slate-500" />
                  <span>Room / Suite</span>
                </button>
                <button
                  type="button"
                  onClick={() => setUnitType('table')}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all flex items-center justify-center gap-1.5 ${
                    unitType === 'table'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <DiningCutleryIcon className="w-3 h-3 text-slate-500" />
                  <span>Dining Table</span>
                </button>
              </div>

              <div className="relative">
                <input
                  type="text"
                  value={unitCode}
                  onChange={(e) => setUnitCode(e.target.value)}
                  placeholder={unitType === 'room' ? 'e.g. 101, 201, or Suite 300' : 'e.g. 12, 14, or Patio 3'}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all font-mono"
                />
              </div>

              {errorMessage && (
                <p className="text-xs text-rose-600 font-medium">{errorMessage}</p>
              )}

              <button
                type="submit"
                className="w-full py-2.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer"
              >
                <RestaurantClocheIcon className="w-4 h-4 text-white" />
                <span>Open Dining Menu</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <div className="flex items-center gap-2 pt-1 text-[11px] text-slate-400">
                <QrCode className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>Guests can also scan the physical QR code in their room.</span>
              </div>
            </form>
          </div>

          {/* Reception Console & Front Desk Hub */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col justify-between space-y-6">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                <HotelBuildingIcon className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Reception Staff Operations
                </h2>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Front office portal for guest check-in, 4-digit stay PIN generation, live continuous tab monitoring, and invoice settlement.
                </p>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <div className="space-y-2 bg-slate-50 rounded-lg p-3 border border-slate-100 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Real-time continuous tab tracking</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Certified PDF folios &amp; digital tax stamps</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Void reconciliations with immutable audit trails</span>
                </div>
              </div>

              <Link
                href="/admin"
                className="w-full py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-xs"
              >
                <HotelBuildingIcon className="w-3.5 h-3.5 text-slate-300" />
                <span>Launch Reception Console</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>

        {/* Security & System Features */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <div className="bg-white border border-slate-200/80 rounded-lg p-4 space-y-1.5">
            <div className="flex items-center gap-2 text-slate-800 font-semibold text-xs">
              <FoodMealIcon className="w-4 h-4 text-emerald-600" />
              <span>Continuous Tab Engine</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Guests append multiple rounds of meals &amp; drinks to a single open tab throughout their stay.
            </p>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-lg p-4 space-y-1.5">
            <div className="flex items-center gap-2 text-slate-800 font-semibold text-xs">
              <FileText className="w-4 h-4 text-blue-600" />
              <span>Certified PDF Folios</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Instant generation of itemized PDF invoices with cryptographic SHA-256 integrity checksums.
            </p>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-lg p-4 space-y-1.5">
            <div className="flex items-center gap-2 text-slate-800 font-semibold text-xs">
              <RoomKeyCardIcon className="w-4 h-4 text-purple-600" />
              <span>Stay PIN Authentication</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Anti-enumeration constant-time hashing with sliding-window edge rate limiting.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-400 font-mono">
          <span>Next.js 14 &bull; Supabase PostgreSQL &bull; Upstash Redis</span>
          <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-[10px] font-mono text-slate-600 font-semibold shadow-2xs">
            v1.00
          </span>
        </div>
      </div>

      {/* Tutorial Modal */}
      <TutorialModal
        isOpen={isTutorialOpen}
        onClose={() => setIsTutorialOpen(false)}
      />
    </div>
  )
}
