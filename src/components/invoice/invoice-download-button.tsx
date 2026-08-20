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
      const { pdf } = await import('@react-pdf/renderer')
      const doc = <DiningInvoicePdfDocument session={session} />
      const asPdf = pdf(doc)
      const blob = await asPdf.toBlob()

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
      'bg-slate-100 text-slate-950 hover:bg-white font-semibold'
  } else if (variant === 'secondary') {
    styleClasses =
      'bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium border border-slate-700'
  } else if (variant === 'outline') {
    styleClasses =
      'bg-transparent hover:bg-slate-800 text-slate-300 hover:text-white font-medium border border-slate-800'
  } else if (variant === 'minimal') {
    styleClasses =
      'bg-transparent hover:bg-slate-800 text-slate-400 hover:text-slate-200'
  }

  return (
    <button
      type="button"
      onClick={handleDownloadPdf}
      disabled={isGenerating}
      className={`px-3 py-1.5 rounded-md text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60 ${styleClasses} ${className}`}
    >
      {isGenerating ? (
        <>
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span>Generating PDF...</span>
        </>
      ) : isDownloaded ? (
        <>
          <Check className="w-3.5 h-3.5 text-emerald-400" />
          <span>Downloaded</span>
        </>
      ) : (
        <>
          <FileText className="w-3.5 h-3.5" />
          <span>{label}</span>
          <Download className="w-3 h-3 opacity-60" />
        </>
      )}
    </button>
  )
}
