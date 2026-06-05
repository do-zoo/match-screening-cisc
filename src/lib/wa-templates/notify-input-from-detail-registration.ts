import type { DetailRegistration } from '@/components/admin/registration-detail-panels/shared/registration-detail-types'
import type { RegistrationNotifyInput } from '@/lib/wa-templates/build-registration-notify'

export function notifyInputFromDetailRegistration(
  registration: DetailRegistration,
  contact: { name: string; whatsapp: string },
  reasons?: { rejectionReason?: string | null; paymentIssueReason?: string | null },
): RegistrationNotifyInput {
  return {
    contactName: contact.name,
    contactWhatsapp: contact.whatsapp,
    registrationId: registration.id,
    computedTotalIdr: registration.computedTotalAtSubmit,
    ticketQty: registration.ticketQty,
    ticketCategoryName: registration.ticketCategory.name,
    rejectionReason: reasons?.rejectionReason ?? registration.rejectionReason,
    paymentIssueReason: reasons?.paymentIssueReason ?? registration.paymentIssueReason,
    event: {
      title: registration.event.title,
      venueName: registration.event.venueName,
      kickOffAt: registration.event.kickOffAt,
      openGateAt: registration.event.openGateAt,
    },
    bank: registration.event.bankAccount ?? undefined,
  }
}
