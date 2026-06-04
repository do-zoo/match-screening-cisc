import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DetailSectionShell } from '@/components/admin/registration-detail-panels/detail-section-shell'
import type { DetailRegistration } from '@/components/admin/registration-detail-panels/shared/registration-detail-types'
import { formatCurrencyIdr } from '@/components/admin/registration-detail-panels/shared/format'
import { IdentitySection } from '@/components/admin/registration-detail-panels/tab-summary/identity-section'
import { HoldersSection } from '@/components/admin/registration-detail-panels/tab-summary/holders-section'
import { PriceSnapshotSection } from '@/components/admin/registration-detail-panels/tab-summary/price-snapshot-section'
import { EventContextSection } from '@/components/admin/registration-detail-panels/tab-summary/event-context-section'
import { Badge } from '@/components/ui/badge'

type Props = {
  eventId: string
  registration: DetailRegistration
}

export function SummaryTab({ eventId, registration }: Props) {
  return (
    <Card>
      <CardHeader className='border-b border-border/60 pb-4'>
        <CardTitle>Ringkasan</CardTitle>
        <CardDescription>
          Profil pendaftar, pemegang tiket, snapshot harga, dan konteks acara untuk verifikasi cepat.
        </CardDescription>
      </CardHeader>
      <CardContent className='grid gap-4 p-4 md:gap-5 md:p-6'>
        <div className='grid gap-4 lg:grid-cols-[minmax(0,1fr)_min(18rem,34%)] lg:items-start lg:gap-5'>
          <DetailSectionShell
            title='Identitas pendaftar'
            description='Kontak utama dan email untuk notifikasi.'
          >
            <IdentitySection eventId={eventId} registration={registration} />
          </DetailSectionShell>

          <DetailSectionShell
            title='Total dibayar'
            description='Snapshot saat formulir dikirim.'
            variant='muted'
            headerEnd={
              <Badge variant='outline' className='shrink-0 font-mono tabular-nums'>
                {formatCurrencyIdr(registration.computedTotalAtSubmit)}
              </Badge>
            }
          >
            <PriceSnapshotSection registration={registration} compact />
          </DetailSectionShell>
        </div>

        <DetailSectionShell
          title='Pemegang tiket'
          description={`${registration.ticketCategory.name} · ${registration.ticketQty} tiket`}
          headerEnd={
            <Badge variant='outline' className='shrink-0 tabular-nums'>
              {registration.holders.length} pemegang
            </Badge>
          }
        >
          <HoldersSection registration={registration} />
        </DetailSectionShell>

        <DetailSectionShell title='Konteks acara' description='Venue, jadwal, dan rekening pembayaran acuan.'>
          <EventContextSection registration={registration} />
        </DetailSectionShell>
      </CardContent>
    </Card>
  )
}
