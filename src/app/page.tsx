'use client'

import Link from 'next/link'
import { BlurFade } from '@/components/ui/blur-fade'
import { MagicCard } from '@/components/ui/magic-card'
import {
  QrCode,
  Lock,
  KeyRound,
  ArrowRight,
  Flame,
  Hotel,
  CheckCircle2,
  FileText,
  CreditCard,
} from 'lucide-react'
import { SEED_LOCATIONS } from '@/lib/data/restaurant-data'

export default function Home() {
  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 md:p-12 overflow-hidden selection:bg-red-500 selection:text-white">
      {/* Dynamic Ambient Background Glow */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[750px] h-[550px] bg-gradient-to-tr from-red-600/20 via-orange-500/15 to-purple-600/10 blur-[140px] rounded-full" />
      <div className="pointer-events-none absolute -bottom-40 right-10 w-[550px] h-[450px] bg-gradient-to-br from-red-600/15 to-amber-500/10 blur-[130px] rounded-full" />

      {/* Hero Header */}
      <div className="relative z-10 max-w-4xl w-full flex flex-col items-center text-center space-y-6">
        <BlurFade delay={0.1} inView>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-red-950/60 border border-red-500/30 text-red-400 text-xs sm:text-sm font-medium backdrop-blur-md shadow-lg shadow-red-950/40">
            <Flame className="w-4 h-4 text-red-500 animate-pulse" />
            <span className="font-semibold tracking-wide">dinescan.fyi</span>
            <span className="text-slate-600">&bull;</span>
            <span className="text-emerald-400 font-semibold">Phase 3: Billing, Invoicing &amp; Admin Console</span>
          </div>
        </BlurFade>

        <BlurFade delay={0.2} inView>
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-white via-slate-100 to-slate-400 leading-[1.15]">
            Smart Dining &amp; <br className="hidden sm:inline" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-orange-400 to-amber-400">
              The &ldquo;Continuous Tab&rdquo;
            </span>
          </h1>
        </BlurFade>

        <BlurFade delay={0.3} inView>
          <p className="max-w-2xl text-slate-400 text-base sm:text-lg leading-relaxed">
            Multi-tenant guest dining with <strong>4-digit stay PINs</strong>, continuous order appending, 
            <strong> Reception Admin Console</strong> for check-in PIN generation, and <strong>certified PDF invoicing</strong>.
          </p>
        </BlurFade>

        {/* Action Buttons */}
        <BlurFade delay={0.35} inView>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link
              href="/admin"
              className="px-6 py-3 rounded-2xl bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white font-bold text-sm shadow-xl shadow-red-950/60 flex items-center gap-2 transition-all cursor-pointer"
            >
              <Hotel className="w-4 h-4" />
              <span>Open Reception Admin Console</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <Link
              href="/room/room-404"
              className="px-5 py-3 rounded-2xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-200 font-semibold text-sm flex items-center gap-2 transition-all"
            >
              <Lock className="w-4 h-4 text-amber-400" />
              <span>Simulate Guest (Suite 404)</span>
            </Link>
          </div>
        </BlurFade>
      </div>

      {/* Interactive Room & Table QR Simulation Section */}
      <BlurFade delay={0.4} inView className="w-full max-w-5xl mt-10">
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 sm:p-8 backdrop-blur-md shadow-2xl">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-6 border-b border-slate-800 gap-3">
            <div>
              <div className="flex items-center gap-2">
                <QrCode className="w-5 h-5 text-red-400" />
                <h2 className="font-bold text-lg text-white">Simulate QR Code Scan</h2>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 mt-1">
                Select a guest room or dining station below to test the PIN challenge &amp; continuous tab workflow:
              </p>
            </div>
            <span className="text-xs px-3 py-1 rounded-full bg-red-950/60 border border-red-500/30 text-red-300 font-mono">
              4 Pre-configured Locations
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
            {SEED_LOCATIONS.map((loc) => {
              const route = loc.locationType === 'table' ? `/table/${loc.qrCodeIdentifier}` : `/room/${loc.qrCodeIdentifier}`
              return (
                <Link
                  key={loc.id}
                  href={route}
                  className="group relative bg-slate-950/70 hover:bg-slate-800/80 border border-slate-800 hover:border-red-500/50 rounded-2xl p-5 flex flex-col justify-between transition-all duration-200 shadow-md hover:shadow-red-950/30"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                        {loc.locationType}
                      </span>
                      <div className="flex items-center gap-1 text-[11px] text-amber-400 font-mono">
                        <KeyRound className="w-3 h-3" />
                        <span>PIN: {loc.accessPin}</span>
                      </div>
                    </div>

                    <h3 className="font-bold text-white text-base group-hover:text-red-400 transition-colors">
                      {loc.name}
                    </h3>
                    <p className="text-xs text-slate-400">
                      Guest: <strong className="text-slate-300">{loc.guestName}</strong>
                    </p>
                  </div>

                  <div className="pt-4 mt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-red-400 font-medium">
                    <span>Scan &amp; Enter PIN</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      </BlurFade>

      {/* Feature Architecture Cards */}
      <BlurFade delay={0.5} inView className="w-full max-w-5xl mt-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Admin Management Console */}
          <MagicCard
            gradientColor="#381519"
            gradientOpacity={0.85}
            className="p-6 flex flex-col justify-between bg-slate-900/60 border-slate-800 backdrop-blur-sm rounded-2xl min-h-[260px] hover:border-red-500/40 transition-colors"
          >
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
                <Hotel className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-semibold text-lg text-white">Reception Console</h3>
                <p className="text-sm text-slate-400 mt-1">
                  Front-desk dashboard to generate stay PINs upon check-in, monitor active guest tabs, and print welcome slips.
                </p>
              </div>
            </div>
            <Link
              href="/admin"
              className="pt-4 flex items-center text-xs text-red-400 font-semibold gap-1 hover:text-red-300 transition-colors"
            >
              <span>Launch Admin Console</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </MagicCard>

          {/* Card 2: Settle Tab & Void Workflow */}
          <MagicCard
            gradientColor="#162e24"
            gradientOpacity={0.85}
            className="p-6 flex flex-col justify-between bg-slate-900/60 border-slate-800 backdrop-blur-sm rounded-2xl min-h-[260px] hover:border-emerald-500/40 transition-colors"
          >
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <CreditCard className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-semibold text-lg text-white">Settle &amp; Void Workflow</h3>
                <p className="text-sm text-slate-400 mt-1">
                  Reconcile orders, void out-of-stock items with automatic tax recalculation, and charge to room folio or card.
                </p>
              </div>
            </div>
            <div className="pt-4 flex items-center text-xs text-emerald-400 font-medium gap-1">
              <span>Checkout Logic Active</span>
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </MagicCard>

          {/* Card 3: PDF Invoicing with react-pdf */}
          <MagicCard
            gradientColor="#2e1b3d"
            gradientOpacity={0.85}
            className="p-6 flex flex-col justify-between bg-slate-900/60 border-slate-800 backdrop-blur-sm rounded-2xl min-h-[260px] hover:border-purple-500/40 transition-colors"
          >
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-semibold text-lg text-white">PDF Folio Generator</h3>
                <p className="text-sm text-slate-400 mt-1">
                  Export beautifully styled, itemized hotel dining invoices generated dynamically with @react-pdf/renderer.
                </p>
              </div>
            </div>
            <div className="pt-4 flex items-center text-xs text-purple-400 font-medium gap-1">
              <span>@react-pdf/renderer Integrated</span>
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </MagicCard>
        </div>
      </BlurFade>

      {/* Tech Stack Summary Footer */}
      <BlurFade delay={0.6} inView className="mt-16 text-center">
        <p className="text-xs text-slate-600 uppercase tracking-widest font-mono">
          Next.js 14 &bull; @react-pdf/renderer &bull; Reception Console &bull; HTTP-Only JWT &bull; Postgres RLS
        </p>
      </BlurFade>
    </div>
  )
}
