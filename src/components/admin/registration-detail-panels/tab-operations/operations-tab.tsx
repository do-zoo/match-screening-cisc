import type { DetailRegistration } from '@/components/admin/registration-detail-panels/shared/registration-detail-types'
import { OperationsTabClient } from '@/components/admin/registration-detail-panels/tab-operations/operations-tab-client'
import type { ClubWaBodies } from '@/lib/wa-templates/render-wa-from-db'

type Props = {
  eventId: string
  registration: DetailRegistration
  waBodies: ClubWaBodies
}

export function OperationsTab({ eventId, registration, waBodies }: Props) {
  return <OperationsTabClient eventId={eventId} registration={registration} waBodies={waBodies} />
}
