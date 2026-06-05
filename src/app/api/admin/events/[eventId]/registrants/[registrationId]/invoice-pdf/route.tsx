import { NextRequest, NextResponse } from 'next/server'

import { guardEvent, isAuthError } from '@/lib/actions/guard'
import { loadRegistrationInvoicePdfData } from '@/lib/invoices/registration-invoice-pdf-data'
import { renderRegistrationInvoicePdf } from '@/lib/invoices/render-registration-invoice-pdf'
import type { InvoicePdfKind } from '@/lib/invoices/registration-invoice-pdf-types'

function parseKind(raw: string | null): InvoicePdfKind | null {
  if (raw === 'registration' || raw === 'adjustment') return raw
  return null
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string; registrationId: string }> },
) {
  const { eventId, registrationId } = await params

  try {
    await guardEvent(eventId)
  } catch (e) {
    if (isAuthError(e)) {
      const status = e instanceof Error && e.message === 'UNAUTHENTICATED' ? 401 : 403
      return new NextResponse('Tidak diizinkan.', { status })
    }
    throw e
  }

  const kind = parseKind(req.nextUrl.searchParams.get('kind'))
  if (!kind) return new NextResponse('Jenis tagihan tidak valid.', { status: 400 })

  const adjustmentId = req.nextUrl.searchParams.get('adjustmentId') ?? undefined
  const disposition = req.nextUrl.searchParams.get('disposition') === 'attachment' ? 'attachment' : 'inline'

  const loaded = await loadRegistrationInvoicePdfData({
    eventId,
    registrationId,
    kind,
    adjustmentId,
  })

  if (!loaded.ok) {
    const status = loaded.error.includes('tidak ditemukan') ? 404 : 400
    return new NextResponse(loaded.error, { status })
  }

  try {
    const { buffer, filename } = await renderRegistrationInvoicePdf(loaded.data)
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${disposition}; filename="${filename}"`,
      },
    })
  } catch {
    return new NextResponse('Gagal membuat PDF.', { status: 500 })
  }
}
