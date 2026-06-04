import { InvoiceAdjustmentStatus, WaTemplateKey } from '@prisma/client'

import { SendInvoiceEmailButton } from '@/components/admin/send-invoice-email-button'
import type { DetailRegistration } from '@/components/admin/registration-detail-panels/shared/registration-detail-types'
import { formatCurrencyIdr } from '@/components/admin/registration-detail-panels/shared/format'
import { waMeLink } from '@/lib/wa-templates/encode'
import type { ClubWaBodies } from '@/lib/wa-templates/render-wa-from-db'
import {
  renderApprovedMessage,
  renderCancelledMessage,
  renderPaymentIssueMessage,
  renderReceiptMessage,
  renderRefundedMessage,
  renderRejectedMessage,
  renderUnderpaymentInvoiceMessage,
} from '@/lib/wa-templates/render-wa-from-db'

type Props = {
  registration: DetailRegistration
  waBodies: ClubWaBodies
}

export function CommunicationSection({ registration, waBodies }: Props) {
  const wb = waBodies
  const waPhone = registration.contactWhatsapp

  const waLinks = [
    {
      label: 'WhatsApp · penerimaan pendaftaran',
      href: waMeLink(
        waPhone,
        renderReceiptMessage(wb[WaTemplateKey.receipt] ?? null, {
          contactName: registration.contactName,
          eventTitle: registration.event.title,
          registrationId: registration.id,
          computedTotalIdr: registration.computedTotalAtSubmit,
        }),
      ),
      show: true,
    },
    {
      label: 'WhatsApp · disetujui',
      href: waMeLink(
        waPhone,
        renderApprovedMessage(
          wb[WaTemplateKey.approved] ?? null,
          registration.event.title,
          registration.event.venueName,
          registration.event.kickOffAt.toISOString(),
        ),
      ),
      show: registration.status === 'approved',
    },
    {
      label: 'WhatsApp · ditolak',
      href: registration.rejectionReason
        ? waMeLink(waPhone, renderRejectedMessage(wb[WaTemplateKey.rejected] ?? null, registration.rejectionReason))
        : '#',
      show: registration.status === 'rejected' && Boolean(registration.rejectionReason),
    },
    {
      label: 'WhatsApp · masalah pembayaran',
      href: registration.paymentIssueReason
        ? waMeLink(
            waPhone,
            renderPaymentIssueMessage(wb[WaTemplateKey.payment_issue] ?? null, registration.paymentIssueReason),
          )
        : '#',
      show: registration.status === 'payment_issue' && Boolean(registration.paymentIssueReason),
    },
    {
      label: 'WhatsApp · dibatalkan',
      href: waMeLink(
        waPhone,
        renderCancelledMessage(wb[WaTemplateKey.cancelled] ?? null, registration.contactName, registration.event.title),
      ),
      show: registration.status === 'cancelled',
    },
    {
      label: 'WhatsApp · refunded',
      href: waMeLink(
        waPhone,
        renderRefundedMessage(wb[WaTemplateKey.refunded] ?? null, registration.contactName, registration.event.title),
      ),
      show: registration.status === 'refunded',
    },
  ].filter(l => l.show)

  return (
    <div className='grid gap-2'>
      <h3 className='text-sm font-semibold tracking-tight'>Komunikasi (WhatsApp)</h3>
      <p className='text-xs text-muted-foreground'>Klik untuk membuka pesan WhatsApp terisi di tab baru.</p>
      <div className='flex flex-wrap gap-2'>
        {waLinks.map(link => (
          <a
            key={link.label}
            href={link.href}
            target='_blank'
            rel='noopener noreferrer'
            className='inline-flex items-center rounded-md border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent/60'
          >
            {link.label}
          </a>
        ))}
        {registration.adjustments
          .filter(a => a.status === InvoiceAdjustmentStatus.unpaid)
          .map(adj => (
            <span key={adj.id} className='inline-flex flex-wrap items-center gap-2'>
              <a
                href={waMeLink(
                  waPhone,
                  renderUnderpaymentInvoiceMessage(wb[WaTemplateKey.underpayment_invoice] ?? null, {
                    contactName: registration.contactName,
                    eventTitle: registration.event.title,
                    adjustmentAmountIdr: adj.amount,
                    bankName: registration.event.bankAccount?.bankName ?? '',
                    accountNumber: registration.event.bankAccount?.accountNumber ?? '',
                    accountName: registration.event.bankAccount?.accountName ?? '',
                  }),
                )}
                target='_blank'
                rel='noopener noreferrer'
                className='inline-flex items-center rounded-md border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent/60'
              >
                WhatsApp · tagihan kekurangan ({formatCurrencyIdr(adj.amount)})
              </a>
              {registration.contactEmail ? (
                <SendInvoiceEmailButton eventId={registration.event.id} registrationId={registration.id} />
              ) : null}
            </span>
          ))}
      </div>
    </div>
  )
}
