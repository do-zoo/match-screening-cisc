import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import type { DetailRegistration } from '@/components/admin/registration-detail-panels/shared/registration-detail-types'
import { IdentitySection } from '@/components/admin/registration-detail-panels/tab-summary/identity-section'
import { HoldersSection } from '@/components/admin/registration-detail-panels/tab-summary/holders-section'
import { PriceSnapshotSection } from '@/components/admin/registration-detail-panels/tab-summary/price-snapshot-section'
import { EventContextSection } from '@/components/admin/registration-detail-panels/tab-summary/event-context-section'

type Props = {
  eventId: string
  registration: DetailRegistration
}

export function SummaryTab({ eventId, registration }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Ringkasan</CardTitle>
        <CardDescription>Profil pendaftar, pemegang tiket, dan snapshot harga.</CardDescription>
      </CardHeader>
      <CardContent className='grid gap-4 md:p-6'>
        <section className='grid gap-2'>
          <h3 className='text-sm font-semibold tracking-tight'>Identitas</h3>
          <IdentitySection eventId={eventId} registration={registration} />
        </section>
        <Separator />
        <section className='grid gap-2'>
          <h3 className='text-sm font-semibold tracking-tight'>Pemegang Tiket</h3>
          <HoldersSection registration={registration} />
        </section>
        <Separator />
        <PriceSnapshotSection registration={registration} />
        <Separator />
        <EventContextSection registration={registration} />
      </CardContent>
    </Card>
  )
}
