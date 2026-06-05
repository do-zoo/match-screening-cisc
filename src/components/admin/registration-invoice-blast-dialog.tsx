'use client'

import { useEffect, useState, useTransition } from 'react'

import {
  previewRegistrationInvoiceEmailBlast,
  runRegistrationInvoiceEmailBlast,
} from '@/lib/actions/admin-registration-invoice-email'
import { toastActionErr, toastCudSuccess } from '@/lib/client/cud-notify'
import type { EventRegistrantsTab } from '@/lib/admin/event-registrants-list-url'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'

type Preview = {
  eligible: number
  skippedNoEmail: number
  skippedHasUnderpayment: number
  skippedStatus: number
}

export function RegistrationInvoiceEmailBlastDialog({
  eventId,
  tab,
  searchQuery,
}: {
  eventId: string
  tab: EventRegistrantsTab
  searchQuery: string
}) {
  const [open, setOpen] = useState(false)
  const [respectListTab, setRespectListTab] = useState(false)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [loadPending, startLoad] = useTransition()
  const [blastPending, startBlast] = useTransition()

  useEffect(() => {
    if (!open) return
    startLoad(async () => {
      const r = await previewRegistrationInvoiceEmailBlast(eventId, {
        respectListTab,
        tab,
        q: searchQuery,
      })
      if (r.ok) setPreview(r.data)
      else {
        setPreview(null)
        toastActionErr(r)
      }
    })
  }, [open, eventId, respectListTab, tab, searchQuery])

  function handleBlast() {
    startBlast(async () => {
      const r = await runRegistrationInvoiceEmailBlast(eventId, { respectListTab, tab, q: searchQuery })
      if (!r.ok) {
        toastActionErr(r)
        return
      }
      toastCudSuccess(
        'update',
        `Email terkirim: ${r.data.sent} sukses, ${r.data.failed} gagal, ${r.data.skipped} dilewati.`,
      )
      setOpen(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger disabled={blastPending} render={<Button variant='outline' size='sm' />}>
        Kirim tagihan pendaftaran (email)
      </DialogTrigger>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>Blast email tagihan pendaftaran</DialogTitle>
          <DialogDescription>
            Mengirim email tagihan nominal pendaftaran awal ke peserta yang punya email kontak dan belum punya tagihan
            kekurangan aktif.
          </DialogDescription>
        </DialogHeader>
        <div className='space-y-4 text-sm'>
          {loadPending ? (
            <p className='text-muted-foreground'>Memuat ringkasan…</p>
          ) : preview ? (
            <ul className='list-disc space-y-1 pl-5 text-muted-foreground'>
              <li>
                <span className='font-medium text-foreground'>{preview.eligible}</span> siap dikirim
              </li>
              <li>{preview.skippedNoEmail} tanpa email kontak</li>
              <li>{preview.skippedHasUnderpayment} punya tagihan kekurangan (gunakan blast kekurangan)</li>
              <li>{preview.skippedStatus} status dikecualikan</li>
            </ul>
          ) : null}
          <label className='flex cursor-pointer items-center gap-2'>
            <Checkbox checked={respectListTab} onCheckedChange={c => setRespectListTab(c === true)} />
            <Label className='cursor-pointer font-normal'>Batasi ke filter status tab saat ini</Label>
          </label>
        </div>
        <DialogFooter>
          <Button type='button' variant='outline' onClick={() => setOpen(false)} disabled={blastPending}>
            Batal
          </Button>
          <Button
            type='button'
            onClick={handleBlast}
            disabled={blastPending || loadPending || !preview || preview.eligible === 0}
          >
            {blastPending ? 'Mengirim…' : 'Kirim sekarang'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
