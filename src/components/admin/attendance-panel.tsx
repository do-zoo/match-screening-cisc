'use client'

import { useState, useTransition } from 'react'
import { AttendanceStatus, RegistrationStatus } from '@prisma/client'
import { CheckIcon, RotateCcwIcon, UserXIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { setAttendance } from '@/lib/actions/attendance'
import { toastActionErr, toastCudSuccess } from '@/lib/client/cud-notify'
import { cn } from '@/lib/utils'

type Props = {
  eventId: string
  registrationId: string
  current: AttendanceStatus
  registrationStatus: RegistrationStatus
  canSetAttendance?: boolean
  statusLabel?: string
}

export function AttendancePanel({
  eventId,
  registrationId,
  current,
  registrationStatus,
  canSetAttendance: canSetAttendanceProp,
  statusLabel,
}: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const canSetAttendance = canSetAttendanceProp ?? registrationStatus === RegistrationStatus.approved

  function handleSet(status: AttendanceStatus) {
    setError(null)
    startTransition(async () => {
      const result = await setAttendance(eventId, registrationId, status)
      if (!result.ok) {
        toastActionErr(result)
        setError(result.rootError ?? 'Terjadi kesalahan.')
      } else {
        toastCudSuccess('update', 'Kehadiran diperbarui.')
      }
    })
  }

  if (!canSetAttendance) {
    return (
      <p className='text-sm leading-relaxed text-muted-foreground'>
        Kehadiran hanya dapat dicatat setelah pendaftaran disetujui.
        {statusLabel ? (
          <>
            {' '}
            Status saat ini: <span className='font-medium text-foreground'>{statusLabel}</span>.
          </>
        ) : null}
      </p>
    )
  }

  return (
    <div className='grid gap-3'>
      <p className='text-sm text-muted-foreground'>
        Status: <span className='font-medium text-foreground'>{statusLabel ?? current.replace('_', ' ')}</span>
      </p>

      <div className='grid gap-2'>
        <Button
          variant='default'
          className={cn(
            'w-full justify-center gap-2',
            'bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500',
          )}
          disabled={isPending || current === AttendanceStatus.attended}
          onClick={() => handleSet(AttendanceStatus.attended)}
        >
          <CheckIcon className='size-4' aria-hidden />
          Hadir
        </Button>
        <div className='grid grid-cols-2 gap-2'>
          <Button
            variant='outline'
            className='justify-center gap-1.5'
            disabled={isPending || current === AttendanceStatus.no_show}
            onClick={() => handleSet(AttendanceStatus.no_show)}
          >
            <UserXIcon className='size-4' aria-hidden />
            Tidak hadir
          </Button>
          <Button
            variant='ghost'
            className='justify-center gap-1.5 text-muted-foreground hover:text-foreground'
            disabled={isPending || current === AttendanceStatus.unknown}
            onClick={() => handleSet(AttendanceStatus.unknown)}
          >
            <RotateCcwIcon className='size-4' aria-hidden />
            Reset
          </Button>
        </div>
      </div>

      {error ? <p className='text-sm text-destructive'>{error}</p> : null}
    </div>
  )
}
