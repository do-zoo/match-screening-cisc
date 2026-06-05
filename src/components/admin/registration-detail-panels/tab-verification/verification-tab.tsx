import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { DetailRegistration } from '@/components/admin/registration-detail-panels/shared/registration-detail-types'
import type { TicketContextVm } from '@/lib/registrations/admin-ticket-context'
import type { ClubWaBodies } from '@/lib/wa-templates/render-wa-from-db'
import { DecisionSection } from '@/components/admin/registration-detail-panels/tab-verification/decision-section'
import { EvidenceSection } from '@/components/admin/registration-detail-panels/tab-verification/evidence-section'

type Props = {
  eventId: string
  registration: DetailRegistration
  ticketContext: TicketContextVm
  waBodies: ClubWaBodies
}

export function VerificationTab({ eventId, registration, ticketContext, waBodies }: Props) {
  return (
    <Card>
      <CardHeader className='border-b border-border/60 pb-4'>
        <CardTitle>Verifikasi & Komunikasi</CardTitle>
        <CardDescription>
          Tinjau bukti transfer, periksa bentrok nomor member, lalu ambil keputusan verifikasi.
        </CardDescription>
      </CardHeader>
      <CardContent className='grid gap-6 p-4 md:p-6 lg:grid-cols-[minmax(0,1fr)_min(18rem,34%)] lg:items-start lg:gap-8'>
        <EvidenceSection eventId={eventId} registration={registration} ticketContext={ticketContext} />
        <aside className='lg:sticky lg:top-[calc(var(--header-offset,0)+3.5rem)]'>
          <DecisionSection eventId={eventId} registration={registration} waBodies={waBodies} />
        </aside>
      </CardContent>
    </Card>
  )
}
