'use client'

import React, { useState } from 'react'
import { FileText, Download, Loader2, Check } from 'lucide-react'
import { GuestTabSession } from '@/lib/data/restaurant-data'
import { DiningInvoicePdfDocument } from './dining-invoice-pdf'

interface InvoiceDownloadButtonProps {
  session: GuestTabSession
  variant?: 'primary' | 'secondary' | 'outline' | 'minimal'
  label?: string
  className?: string
}

export function InvoiceDownloadButton({
  session,
  variant = 'primary',
  label = 'Download PDF Invoice',
  className = '',
}: InvoiceDownloadButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [isDownloaded, setIsDownloaded] = useState(false)

  const handleDownloadPdf = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isGenerating) return

    setIsGenerating(true)
    try {
      // Dynamic import of pdf function from @react-pdf/renderer to avoid SSR issues
      const { pdf } = await import('@react-pdf/renderer')
      const doc = <DiningInvoicePdfDocument session={session} />
      const asPdf = pdf(doc)
      const blob = await asPdf.toBlob()

      // Create download link
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const invoiceNum =
        session.invoiceNumber ||
        `Invoice-${session.locationIdentifier}-${Date.now().toString().slice(-4)}`
      a.download = `${invoiceNum}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      setIsDownloaded(true)
      setTimeout(() => setIsDownloaded(false), 3000)
    } catch (err) {
      console.error('Failed to generate PDF invoice:', err)
      alert('Could not generate PDF invoice. Please try again.')
    } finally {
      setIsGenerating(false)
    }
  }

  let styleClasses = ''
  if (variant === 'primary') {
    styleClasses =
      'bg-red-600 hover:bg-red-500 text-white font-semibold shadow-lg shadow-red-950/40'
  } else if (variant === 'secondary') {
    styleClasses =
      'bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium border border-slate-700'
  } else if (variant === 'outline') {
    styleClasses =
      'bg-transparent hover:bg-red-950/30 text-red-400 hover:text-red-300 font-semibold border border-red-500/40'
  } else if (variant === 'minimal') {
    styleClasses =
      'bg-transparent hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-xs'
  }

  return (
    <button
      type="button"
      onClick={handleDownloadPdf}
      disabled={isGenerating}
      className={`px-3.5 py-2 rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-60 ${styleClasses} ${className}`}
    >
      {isGenerating ? (
        <>
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span>Generating PDF...</span>
        </>
      ) : isDownloaded ? (
        <>
          <Check className="w-3.5 h-3.5 text-emerald-400" />
          <span>PDF Downloaded!</span>
        </>
      ) : (
        <>
          <FileText className="w-3.5 h-3.5" />
          <span>{label}</span>
          <Download className="w-3.5 h-3.5 ml-0.5 opacity-70" />
        </>
      )}
    </button>
  )
}
