import { RegistrationInvoicePdfButton } from '@/components/admin/registration-invoice-pdf-button'
import { RegistrationDetailHeader } from '@/components/admin/registration-detail-panels/registration-detail-header'
import { RegistrationDetailTabs } from '@/components/admin/registration-detail-panels/registration-detail-tabs'
import { SummaryTab } from '@/components/admin/registration-detail-panels/tab-summary/summary-tab'
import { VerificationTab } from '@/components/admin/registration-detail-panels/tab-verification/verification-tab'
import { OperationsTab } from '@/components/admin/registration-detail-panels/tab-operations/operations-tab'
import type { DetailRegistration } from '@/components/admin/registration-detail-panels/shared/registration-detail-types'
import type { RegistrationDetailTab } from '@/lib/admin/event-registration-detail-tab'
import type { TicketContextVm } from '@/lib/registrations/admin-ticket-context'
import { buildRegistrationInvoicePdfUrl } from '@/lib/invoices/build-registration-invoice-pdf-url'
import { canDownloadRegistrationInvoicePdf } from '@/lib/invoices/registration-invoice-pdf-eligibility'
import { resolveDetailRegistrationContact } from '@/lib/registrations/registration-primary-contact'
import type { ClubWaBodies } from '@/lib/wa-templates/render-wa-from-db'

type Props = {
  eventId: string
  tab: RegistrationDetailTab
  registration: DetailRegistration
  ticketContext: TicketContextVm
  waBodies: ClubWaBodies
  showOperasiBadge: boolean
}

export function RegistrationDetailShell({
  eventId,
  tab,
  registration,
  ticketContext,
  waBodies,
  showOperasiBadge,
}: Props) {
  const contact = resolveDetailRegistrationContact(registration)
  const showRegistrationInvoicePdf = canDownloadRegistrationInvoicePdf({
    kind: 'registration',
    registrationStatus: registration.status,
  })

  return (
    <div className='flex flex-col gap-4'>
      <RegistrationDetailHeader
        contactName={contact.name}
        contactWhatsapp={contact.whatsapp}
        computedTotalAtSubmit={registration.computedTotalAtSubmit}
        createdAt={registration.createdAt}
        status={registration.status}
        rejectionReason={registration.rejectionReason}
        paymentIssueReason={registration.paymentIssueReason}
        invoicePdfAction={
          showRegistrationInvoicePdf ? (
            <RegistrationInvoicePdfButton
              label='Tagihan PDF'
              dialogTitle='Pratinjau tagihan pendaftaran'
              previewUrl={buildRegistrationInvoicePdfUrl({
                eventId,
                registrationId: registration.id,
                kind: 'registration',
                disposition: 'inline',
              })}
              downloadUrl={buildRegistrationInvoicePdfUrl({
                eventId,
                registrationId: registration.id,
                kind: 'registration',
                disposition: 'attachment',
              })}
            />
          ) : undefined
        }
      />
      <RegistrationDetailTabs
        eventId={eventId}
        registrationId={registration.id}
        tab={tab}
        showOperasiBadge={showOperasiBadge}
        panels={{
          ringkasan: <SummaryTab eventId={eventId} registration={registration} />,
          verifikasi: (
            <VerificationTab
              eventId={eventId}
              registration={registration}
              ticketContext={ticketContext}
              waBodies={waBodies}
            />
          ),
          operasi: <OperationsTab eventId={eventId} registration={registration} waBodies={waBodies} />,
        }}
      />
    </div>
  )
}
