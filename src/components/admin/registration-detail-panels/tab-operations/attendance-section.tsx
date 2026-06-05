import { AttendanceStatus, RegistrationStatus } from '@prisma/client'

import { AttendancePanel } from '@/components/admin/attendance-panel'
import type { DetailRegistration } from '@/components/admin/registration-detail-panels/shared/registration-detail-types'
import { OperationSectionShell } from '@/components/admin/registration-detail-panels/tab-operations/operation-section-shell'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type Props = {
  eventId: string
  registration: DetailRegistration
}

const ATTENDANCE_LABEL_ID: Record<AttendanceStatus, string> = {
  unknown: 'Belum dicatat',
  attended: 'Hadir',
  no_show: 'Tidak hadir',
}

const ATTENDANCE_BADGE: Record<AttendanceStatus, string> = {
  unknown:
    'border-zinc-200 bg-zinc-50 text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-200',
  attended:
    'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50',
  no_show:
    'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-50',
}

export function AttendanceSection({ eventId, registration }: Props) {
  const canSetAttendance = registration.status === RegistrationStatus.approved

  return (
    <OperationSectionShell
      title='Kehadiran'
      description='Catat kehadiran peserta saat hari acara.'
      headerEnd={
        <Badge variant='outline' className={cn('shrink-0', ATTENDANCE_BADGE[registration.attendanceStatus])}>
          {ATTENDANCE_LABEL_ID[registration.attendanceStatus]}
        </Badge>
      }
    >
      <AttendancePanel
        eventId={eventId}
        registrationId={registration.id}
        current={registration.attendanceStatus}
        registrationStatus={registration.status}
        canSetAttendance={canSetAttendance}
        statusLabel={ATTENDANCE_LABEL_ID[registration.attendanceStatus]}
      />
    </OperationSectionShell>
  )
}
