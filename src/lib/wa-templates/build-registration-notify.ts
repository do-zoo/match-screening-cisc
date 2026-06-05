import { type RegistrationStatus, WaTemplateKey } from '@prisma/client'

import { normalizeIdPhone, waMeLink } from '@/lib/wa-templates/encode'
import { templateEmailInvoiceReminder } from '@/lib/wa-templates/messages'
import type { ClubWaBodies } from '@/lib/wa-templates/render-wa-from-db'
import {
  renderApprovedMessage,
  renderCancelledMessage,
  renderPaymentIssueMessage,
  renderRefundedMessage,
  renderRejectedMessage,
} from '@/lib/wa-templates/render-wa-from-db'
import { registrationNotifyToWaContext } from '@/lib/wa-templates/wa-template-vars'

export type RegistrationNotifyKind =
  | 'approved'
  | 'rejected'
  | 'payment_issue'
  | 'cancelled'
  | 'refunded'
  | 'underpayment_email_reminder'

export type RegistrationNotifyInput = {
  contactName: string
  contactWhatsapp: string
  registrationId: string
  computedTotalIdr: number
  ticketQty: number
  ticketCategoryName: string
  rejectionReason: string | null
  paymentIssueReason: string | null
  event: {
    title: string
    venueName: string
    kickOffAt: Date
    openGateAt: Date | null
  }
  bank?: { bankName: string; accountNumber: string; accountName: string }
}

export type RegistrationNotifyPayload = {
  titleId: string
  preview: string
  href: string
  canOpen: boolean
  disabledReasonId: string | null
}

const TITLES: Record<RegistrationNotifyKind, string> = {
  approved: 'Pendaftaran disetujui',
  rejected: 'Pendaftaran ditolak',
  payment_issue: 'Kendala pembayaran',
  cancelled: 'Pendaftaran dibatalkan',
  refunded: 'Pengembalian dana',
  underpayment_email_reminder: 'Tagihan dikirim via email',
}

function phoneCanOpen(phone: string): boolean {
  const n = normalizeIdPhone(phone)
  return n.length >= 10 && n.startsWith('62')
}

export function buildRegistrationWaNotify(args: {
  kind: RegistrationNotifyKind
  registration: RegistrationNotifyInput
  waBodies: ClubWaBodies
  adjustmentAmountIdr?: number
}): RegistrationNotifyPayload {
  const { kind, registration: r, waBodies: wb } = args
  let preview = ''

  const waCtx = registrationNotifyToWaContext({
    ...r,
    adjustmentAmountIdr: args.adjustmentAmountIdr,
  })

  switch (kind) {
    case 'approved':
      preview = renderApprovedMessage(wb[WaTemplateKey.approved] ?? null, waCtx)
      break
    case 'rejected':
      if (!r.rejectionReason?.trim()) {
        return {
          titleId: TITLES.rejected,
          preview: '',
          href: '',
          canOpen: false,
          disabledReasonId: 'Alasan penolakan belum diisi.',
        }
      }
      preview = renderRejectedMessage(
        wb[WaTemplateKey.rejected] ?? null,
        registrationNotifyToWaContext(r, r.rejectionReason),
      )
      break
    case 'payment_issue':
      if (!r.paymentIssueReason?.trim()) {
        return {
          titleId: TITLES.payment_issue,
          preview: '',
          href: '',
          canOpen: false,
          disabledReasonId: 'Alasan kendala pembayaran belum diisi.',
        }
      }
      preview = renderPaymentIssueMessage(
        wb[WaTemplateKey.payment_issue] ?? null,
        registrationNotifyToWaContext(r, r.paymentIssueReason),
      )
      break
    case 'cancelled':
      preview = renderCancelledMessage(wb[WaTemplateKey.cancelled] ?? null, waCtx)
      break
    case 'refunded':
      preview = renderRefundedMessage(wb[WaTemplateKey.refunded] ?? null, waCtx)
      break
    case 'underpayment_email_reminder':
      preview = templateEmailInvoiceReminder({
        contactName: r.contactName,
        eventTitle: r.event.title,
        adjustmentAmountIdr: args.adjustmentAmountIdr ?? 0,
      })
      break
  }

  const canOpen = phoneCanOpen(r.contactWhatsapp) && preview.length > 0
  const href = canOpen ? waMeLink(r.contactWhatsapp, preview) : ''

  return {
    titleId: TITLES[kind],
    preview,
    href,
    canOpen,
    disabledReasonId: canOpen ? null : 'Nomor WhatsApp tidak valid atau pesan kosong.',
  }
}

export function resendNotifyKindForStatus(status: RegistrationStatus): RegistrationNotifyKind | null {
  if (status === 'approved') return 'approved'
  if (status === 'rejected') return 'rejected'
  if (status === 'payment_issue') return 'payment_issue'
  return null
}

export function canResendNotifyForStatus(
  status: RegistrationStatus,
  registration: RegistrationNotifyInput,
  waBodies: ClubWaBodies,
): boolean {
  const kind = resendNotifyKindForStatus(status)
  if (!kind) return false
  const payload = buildRegistrationWaNotify({ kind, registration, waBodies })
  return payload.preview.length > 0
}
