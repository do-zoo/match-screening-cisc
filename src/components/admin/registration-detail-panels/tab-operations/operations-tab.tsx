import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import type { DetailRegistration } from '@/components/admin/registration-detail-panels/shared/registration-detail-types'
import { AttendanceSection } from '@/components/admin/registration-detail-panels/tab-operations/attendance-section'
import { InvoiceAdjustmentsSection } from '@/components/admin/registration-detail-panels/tab-operations/invoice-adjustments-section'
import { CancelRefundSection } from '@/components/admin/registration-detail-panels/tab-operations/cancel-refund-section'

type Props = {
  eventId: string
  registration: DetailRegistration
}

export function OperationsTab({ eventId, registration }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Operasi</CardTitle>
        <CardDescription>Kehadiran, penyesuaian invoice, dan pembatalan atau refund.</CardDescription>
      </CardHeader>
      <CardContent className='grid gap-4 md:p-6'>
        <AttendanceSection eventId={eventId} registration={registration} />
        <Separator />
        <InvoiceAdjustmentsSection eventId={eventId} registration={registration} />
        <Separator />
        <CancelRefundSection eventId={eventId} registration={registration} />
      </CardContent>
    </Card>
  )
}
