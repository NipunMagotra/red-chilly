'use client'

import Link from 'next/link'
import {
  QrCode,
  Hotel,
  CheckCircle2,
  FileText,
  CreditCard,
  ExternalLink,
  ArrowRight,
} from 'lucide-react'
import { SEED_LOCATIONS } from '@/lib/data/restaurant-data'

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col items-center p-4 sm:p-8">
      <div className="max-w-5xl w-full space-y-6">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-slate-500 font-semibold">DINESCAN</span>
              <span className="text-slate-300">&bull;</span>
              <span className="text-xs font-mono text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded font-semibold">
                ENTERPRISE HOSPITALITY
              </span>
            </div>
            <h1 className="text-lg sm:text-xl font-semibold text-slate-900 mt-1">
              Smart Dining &amp; Continuous Tab Platform
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Multi-tenant guest ordering with 4-digit stay PINs, continuous order appending, and reception admin folios.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/admin"
              className="px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <Hotel className="w-3.5 h-3.5" />
              <span>Reception Console</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Simulation Hub: Pre-Configured Location Units */}
        <div className="bg-white border border-slate-200 rounded-md overflow-hidden shadow-xs">
          <div className="px-4 py-2.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2">
              <QrCode className="w-4 h-4 text-slate-600" />
              <h2 className="text-xs font-semibold text-slate-800">
                Simulate QR Code Scan &bull; Active Units
              </h2>
            </div>
            <span className="text-[11px] font-mono text-slate-500">
              4 Pre-configured Locations
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-mono text-[11px] border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3 font-medium">Location Unit</th>
                  <th className="py-2.5 px-3 font-medium">Type</th>
                  <th className="py-2.5 px-3 font-medium">QR Route</th>
                  <th className="py-2.5 px-3 font-medium">Default Stay PIN</th>
                  <th className="py-2.5 px-3 font-medium">Assigned Guest</th>
                  <th className="py-2.5 px-3 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {SEED_LOCATIONS.map((loc) => {
                  const route =
                    loc.locationType === 'table'
                      ? `/table/${loc.qrCodeIdentifier}`
                      : `/room/${loc.qrCodeIdentifier}`
                  return (
                    <tr key={loc.id} className="hover:bg-slate-50/80">
                      <td className="py-2.5 px-3 font-semibold text-slate-900">
                        {loc.name}
                      </td>
                      <td className="py-2.5 px-3 uppercase text-[10px] text-slate-500 font-mono">
                        {loc.locationType}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-500 text-xs">
                        {route}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-800">
                        <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                          {loc.accessPin}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-700">
                        {loc.guestName}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <Link
                          href={route}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-medium cursor-pointer shadow-2xs"
                        >
                          <span>Open Guest View</span>
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Enterprise Architecture Modules */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="bg-white border border-slate-200 rounded-md p-4 space-y-2 shadow-xs">
            <div className="flex items-center gap-2 text-slate-900">
              <Hotel className="w-4 h-4 text-blue-600" />
              <h3 className="text-xs font-semibold">Reception Admin Console</h3>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Front desk operations for room check-in, stay PIN generation, real-time continuous tab tracking, and void reconciliations.
            </p>
            <div className="pt-2">
              <Link
                href="/admin"
                className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 font-semibold"
              >
                <span>Access /admin</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-md p-4 space-y-2 shadow-xs">
            <div className="flex items-center gap-2 text-slate-900">
              <CreditCard className="w-4 h-4 text-emerald-600" />
              <h3 className="text-xs font-semibold">Continuous Tab Engine</h3>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Enables guests to append multiple order rounds to a single open tab throughout their stay with zero double-billing risk.
            </p>
            <div className="pt-2 flex items-center gap-1 text-xs text-emerald-700 font-mono font-medium">
              <CheckCircle2 className="w-3 h-3" />
              <span>48h Idempotency Active</span>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-md p-4 space-y-2 shadow-xs">
            <div className="flex items-center gap-2 text-slate-900">
              <FileText className="w-4 h-4 text-slate-700" />
              <h3 className="text-xs font-semibold">Certified PDF Invoicing</h3>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Instant generation of itemized PDF folios with digital verification stamps powered by @react-pdf/renderer.
            </p>
            <div className="pt-2 flex items-center gap-1 text-xs text-slate-500 font-mono">
              <span>WORM Trigger Protected</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-400 font-mono">
          <span>Next.js 14 &bull; Supabase PostgreSQL &bull; Upstash Redis</span>
          <span>Red Chilly v0.1.0</span>
        </div>
      </div>
    </div>
  )
}
