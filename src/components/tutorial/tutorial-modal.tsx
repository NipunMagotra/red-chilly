'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  X,
  BookOpen,
  KeyRound,
  QrCode,
  UtensilsCrossed,
  CreditCard,
  FileText,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Hotel,
  Layers,
  Sparkles,
} from 'lucide-react'

interface TutorialModalProps {
  isOpen: boolean
  onClose: () => void
}

export function TutorialModal({ isOpen, onClose }: TutorialModalProps) {
  const [activeTab, setActiveTab] = useState<'quickstart' | 'staff' | 'guest'>('quickstart')

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                <span>System Tutorial &amp; Guide</span>
                <span className="text-[10px] font-mono bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded font-semibold">
                  HOW IT WORKS
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Learn how staff and guests interact with continuous dining tabs.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="px-6 pt-3 pb-1 border-b border-slate-100 flex items-center gap-2 bg-white">
          <button
            onClick={() => setActiveTab('quickstart')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'quickstart'
                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
            }`}
          >
            🚀 Quick Start (60s)
          </button>
          <button
            onClick={() => setActiveTab('staff')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'staff'
                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
            }`}
          >
            🏨 Reception Staff Flow
          </button>
          <button
            onClick={() => setActiveTab('guest')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'guest'
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
            }`}
          >
            🍽️ Guest Dining Flow
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs text-slate-600 leading-relaxed">
          {/* TAB 1: QUICK START */}
          {activeTab === 'quickstart' && (
            <div className="space-y-4">
              <div className="p-3 bg-gradient-to-r from-rose-50/50 to-orange-50/50 border border-rose-100 rounded-xl space-y-1">
                <span className="font-semibold text-slate-900 flex items-center gap-1.5 text-xs">
                  <Sparkles className="w-3.5 h-3.5 text-rose-600" />
                  What is DineScan?
                </span>
                <p className="text-[11px] text-slate-600">
                  DineScan is a hotel &amp; restaurant platform that lets guests append multiple food and beverage orders to a single continuous tab throughout their stay using secure 4-digit stay PINs, with certified PDF invoicing for checkout.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="border border-slate-200 rounded-xl p-3.5 space-y-2 bg-slate-50/50">
                  <div className="flex items-center gap-2 font-bold text-slate-900">
                    <span className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px]">1</span>
                    <span>Check-In at Reception</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Go to <strong className="text-slate-700">/admin</strong> with passcode <code className="bg-slate-200 px-1 py-0.5 rounded text-slate-800 font-mono">redchilly2026</code>. Click <strong>Check-In Guest</strong> to register a room (e.g. Room 101) and generate a 4-digit PIN.
                  </p>
                </div>

                <div className="border border-slate-200 rounded-xl p-3.5 space-y-2 bg-slate-50/50">
                  <div className="flex items-center gap-2 font-bold text-slate-900">
                    <span className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px]">2</span>
                    <span>Guest Scans &amp; Enters PIN</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Guest opens <strong className="text-slate-700">/room/101</strong> (or scans room QR code), enters their 4-digit stay PIN, and accesses the digital dining menu.
                  </p>
                </div>

                <div className="border border-slate-200 rounded-xl p-3.5 space-y-2 bg-slate-50/50">
                  <div className="flex items-center gap-2 font-bold text-slate-900">
                    <span className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px]">3</span>
                    <span>Append Orders to Tab</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Guest adds dishes and clicks &quot;Append Order to Tab&quot;. Orders are added in real-time. Guests can place multiple rounds anytime.
                  </p>
                </div>

                <div className="border border-slate-200 rounded-xl p-3.5 space-y-2 bg-slate-50/50">
                  <div className="flex items-center gap-2 font-bold text-slate-900">
                    <span className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px]">4</span>
                    <span>Settle &amp; Download PDF Folio</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    At checkout, reception clicks <strong>Settle Tab</strong> in the console to seal the tab and instantly download a certified itemized PDF folio.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: STAFF GUIDE */}
          {activeTab === 'staff' && (
            <div className="space-y-3.5">
              <div className="flex items-start gap-3 p-3 bg-blue-50/60 border border-blue-100 rounded-xl">
                <KeyRound className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="font-bold text-slate-900 text-xs">Step 1: Check-In &amp; Generate Stay PIN</h4>
                  <p className="text-[11px] text-slate-600">
                    Click the blue <strong>&quot;Check-In Guest&quot;</strong> button in the top right. Enter the room or table number (e.g. <code>101</code> or <code>Table 5</code>), enter the guest name, and click <strong>Randomize PIN</strong> or type a custom 4-digit PIN.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <Layers className="w-5 h-5 text-slate-700 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="font-bold text-slate-900 text-xs">Step 2: Monitor Active Continuous Tabs</h4>
                  <p className="text-[11px] text-slate-600">
                    The <strong>&quot;Active Tabs&quot;</strong> view lists all live tabs, showing room number, guest name, total items, round counts, and running total revenue updated live.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <CreditCard className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="font-bold text-slate-900 text-xs">Step 3: Settle Tab &amp; Checkout</h4>
                  <p className="text-[11px] text-slate-600">
                    Click <strong>&quot;Settle Tab&quot;</strong> next to any room. Choose the payment method (<em>Room Folio</em>, <em>Credit Card</em>, or <em>Cash</em>) and confirm checkout.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <FileText className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="font-bold text-slate-900 text-xs">Step 4: Download Certified PDF Folio</h4>
                  <p className="text-[11px] text-slate-600">
                    In the <strong>&quot;Settled Folios&quot;</strong> tab, click the <strong>&quot;PDF&quot;</strong> button to generate an official hotel folio complete with digital SHA-256 verification stamps.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: GUEST GUIDE */}
          {activeTab === 'guest' && (
            <div className="space-y-3.5">
              <div className="flex items-start gap-3 p-3 bg-emerald-50/60 border border-emerald-100 rounded-xl">
                <QrCode className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="font-bold text-slate-900 text-xs">1. Access Room Dining Portal</h4>
                  <p className="text-[11px] text-slate-600">
                    Guests scan the physical QR code on their room key card or desk stand, or type their room number on the homepage portal (e.g. <code>404</code> &rarr; <code>/room/404</code>).
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="font-bold text-slate-900 text-xs">2. Enter 4-Digit Stay PIN</h4>
                  <p className="text-[11px] text-slate-600">
                    The guest enters the 4-digit PIN provided during check-in. The system securely signs an encrypted session cookie to unlock the continuous tab.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <UtensilsCrossed className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="font-bold text-slate-900 text-xs">3. Browse Menu &amp; Append Orders</h4>
                  <p className="text-[11px] text-slate-600">
                    Guests can filter dishes by category, view dietary tags, adjust quantities, add special kitchen instructions, and append rounds to their open tab with one click.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="font-bold text-slate-900 text-xs">4. Real-Time Tab Tracking</h4>
                  <p className="text-[11px] text-slate-600">
                    The guest can view their running subtotal, taxes, itemized round breakdown, and kitchen status (Pending, Preparing, Delivered) at any time.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer with Direct Actions */}
        <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50/70 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono">
            <span>Staff Passcode:</span>
            <code className="bg-slate-200 text-slate-800 px-1.5 py-0.5 rounded font-bold">redchilly2026</code>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Link
              href="/admin"
              onClick={onClose}
              className="flex-1 sm:flex-initial px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-xs"
            >
              <Hotel className="w-3.5 h-3.5" />
              <span>Launch Reception Console</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
