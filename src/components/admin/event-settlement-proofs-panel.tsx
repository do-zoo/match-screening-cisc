'use client'

import { EventSettlementArtifactKind } from '@prisma/client'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { FileField } from '@/components/ui/file-field'
import { IdrAmountInput } from '@/components/ui/idr-amount-input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { uploadEventSettlementProof } from '@/lib/actions/upload-event-settlement-proof'
import { toastActionErr, toastCudSuccess } from '@/lib/client/cud-notify'
import { settlementAmountMismatch, SETTLEMENT_AMOUNT_TOLERANCE_IDR } from '@/lib/reports/settlement-expected-amounts'
import { formatIdr } from '@/lib/utils/format-idr'

const KIND_LABEL: Record<EventSettlementArtifactKind, string> = {
  [EventSettlementArtifactKind.venue_transfer]: 'Bukti transfer ke venue',
  [EventSettlementArtifactKind.venue_receipt]: 'Nota / bukti terima dari venue',
  [EventSettlementArtifactKind.treasurer_margin]: 'Bukti transfer margin ke bendahara',
}

export type SettlementArtifactRow = {
  id: string
  kind: EventSettlementArtifactKind
  declaredAmountIdr: number | null
  expectedAmountIdr: number | null
  amountDeltaIdr: number | null
  mismatchAcknowledged: boolean
  mismatchReason: string | null
  createdAt: string
  blobUrl: string
  uploaderLabel: string
}

type Props = {
  eventId: string
  canManage: boolean
  expectedVenueMenuPayout: number
  expectedTreasurerMargin: number
  artifacts: SettlementArtifactRow[]
}

export function EventSettlementProofsPanel({
  eventId,
  canManage,
  expectedVenueMenuPayout,
  expectedTreasurerMargin,
  artifacts,
}: Props) {
  const [isPending, startTransition] = useTransition()
  const [venueTransferAmount, setVenueTransferAmount] = useState(0)
  const [treasurerAmount, setTreasurerAmount] = useState(0)
  const [venueTransferFile, setVenueTransferFile] = useState<File | undefined>()
  const [venueReceiptFile, setVenueReceiptFile] = useState<File | undefined>()
  const [treasurerFile, setTreasurerFile] = useState<File | undefined>()
  const [venueTransferFieldKey, setVenueTransferFieldKey] = useState(0)
  const [venueReceiptFieldKey, setVenueReceiptFieldKey] = useState(0)
  const [treasurerFieldKey, setTreasurerFieldKey] = useState(0)

  const [mismatchOpen, setMismatchOpen] = useState(false)
  const [pendingKind, setPendingKind] = useState<EventSettlementArtifactKind | null>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [pendingAmount, setPendingAmount] = useState(0)
  const [mismatchAck, setMismatchAck] = useState(false)
  const [mismatchReason, setMismatchReason] = useState('')

  function needsMismatchDialog(kind: EventSettlementArtifactKind, declared: number): boolean {
    if (kind === EventSettlementArtifactKind.venue_receipt) return false
    const expected =
      kind === EventSettlementArtifactKind.venue_transfer ? expectedVenueMenuPayout : expectedTreasurerMargin
    return !settlementAmountMismatch(declared, expected).withinTolerance
  }

  function runUpload(kind: EventSettlementArtifactKind, file: File, declared: number, ack: boolean, reason: string) {
    const formData = new FormData()
    formData.set('kind', kind)
    formData.set('file', file)
    if (kind !== EventSettlementArtifactKind.venue_receipt) {
      formData.set('declaredAmountIdr', String(declared))
    }
    if (ack) {
      formData.set('mismatchAcknowledged', 'true')
      formData.set('mismatchReason', reason)
    }
    startTransition(async () => {
      const result = await uploadEventSettlementProof(eventId, formData)
      if (!result.ok) {
        toastActionErr(result)
        return
      }
      toastCudSuccess('create', 'Bukti penutupan berhasil diunggah.')
      setMismatchOpen(false)
      setPendingKind(null)
      setPendingFile(null)
      setMismatchAck(false)
      setMismatchReason('')
      setVenueTransferFile(undefined)
      setVenueReceiptFile(undefined)
      setTreasurerFile(undefined)
      setVenueTransferFieldKey(k => k + 1)
      setVenueReceiptFieldKey(k => k + 1)
      setTreasurerFieldKey(k => k + 1)
    })
  }

  function handleRequestUpload(kind: EventSettlementArtifactKind, file: File | undefined, declared: number) {
    if (!canManage) return
    if (!file) {
      toast.error('Pilih file gambar terlebih dahulu.')
      return
    }
    if (kind !== EventSettlementArtifactKind.venue_receipt && (!Number.isFinite(declared) || declared < 0)) {
      toast.error('Isi nominal transfer (IDR).')
      return
    }
    if (needsMismatchDialog(kind, declared)) {
      setPendingKind(kind)
      setPendingFile(file)
      setPendingAmount(declared)
      setMismatchAck(false)
      setMismatchReason('')
      setMismatchOpen(true)
      return
    }
    runUpload(kind, file, declared, false, '')
  }

  function confirmMismatchUpload() {
    if (!pendingKind || !pendingFile) return
    if (!mismatchAck || mismatchReason.trim().length < 3) {
      toast.error('Centang konfirmasi dan isi alasan selisih (minimal 3 karakter).')
      return
    }
    runUpload(pendingKind, pendingFile, pendingAmount, true, mismatchReason.trim())
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Bukti rekapitulasi penutupan</CardTitle>
          <CardDescription>
            Unggahan bersifat riwayat (beberapa versi). PIC acara atau Owner/Admin dapat menambah bukti. Nominal
            transfer ke venue dan ke bendahara dibandingkan dengan acuan laporan; selisih di luar{' '}
            {formatIdr(SETTLEMENT_AMOUNT_TOLERANCE_IDR)} wajib konfirmasi + alasan.
          </CardDescription>
        </CardHeader>
        <CardContent className='flex flex-col gap-8'>
          {canManage ? (
            <>
              <section className='space-y-3 rounded-lg border p-4'>
                <h3 className='text-sm font-medium'>{KIND_LABEL[EventSettlementArtifactKind.venue_transfer]}</h3>
                <p className='text-muted-foreground text-xs'>
                  Acuan nominal: {formatIdr(expectedVenueMenuPayout)} (agregat menu wajib approved)
                </p>
                <div className='max-w-xs space-y-2'>
                  <Label htmlFor='venue-transfer-amount'>Nominal transfer</Label>
                  <IdrAmountInput
                    id='venue-transfer-amount'
                    value={venueTransferAmount}
                    onValueChange={setVenueTransferAmount}
                    disabled={isPending}
                  />
                </div>
                <div className='flex max-w-lg flex-col gap-3 sm:flex-row sm:items-end'>
                  <div className='min-w-0 flex-1'>
                    <FileField
                      key={`vt-${venueTransferFieldKey}`}
                      id={`settlement-venue-transfer-${venueTransferFieldKey}`}
                      label='Berkas bukti'
                      accept='image/jpeg,image/png,image/webp,image/heic,image/heif'
                      disabled={isPending}
                      pickPrompt='Ketuk untuk memilih bukti'
                      replacePrompt='Ganti bukti'
                      onChange={setVenueTransferFile}
                    />
                  </div>
                  <Button
                    type='button'
                    className='shrink-0'
                    disabled={isPending}
                    onClick={() =>
                      handleRequestUpload(
                        EventSettlementArtifactKind.venue_transfer,
                        venueTransferFile,
                        venueTransferAmount,
                      )
                    }
                  >
                    Unggah
                  </Button>
                </div>
              </section>

              <section className='space-y-3 rounded-lg border p-4'>
                <h3 className='text-sm font-medium'>{KIND_LABEL[EventSettlementArtifactKind.venue_receipt]}</h3>
                <p className='text-muted-foreground text-xs'>
                  Tidak memerlukan nominal; unggah nota atau bukti terima dari venue.
                </p>
                <div className='flex max-w-lg flex-col gap-3 sm:flex-row sm:items-end'>
                  <div className='min-w-0 flex-1'>
                    <FileField
                      key={`vr-${venueReceiptFieldKey}`}
                      id={`settlement-venue-receipt-${venueReceiptFieldKey}`}
                      label='Berkas bukti'
                      accept='image/jpeg,image/png,image/webp,image/heic,image/heif'
                      disabled={isPending}
                      pickPrompt='Ketuk untuk memilih bukti'
                      replacePrompt='Ganti bukti'
                      onChange={setVenueReceiptFile}
                    />
                  </div>
                  <Button
                    type='button'
                    className='shrink-0'
                    disabled={isPending}
                    onClick={() => handleRequestUpload(EventSettlementArtifactKind.venue_receipt, venueReceiptFile, 0)}
                  >
                    Unggah
                  </Button>
                </div>
              </section>

              <section className='space-y-3 rounded-lg border p-4'>
                <h3 className='text-sm font-medium'>{KIND_LABEL[EventSettlementArtifactKind.treasurer_margin]}</h3>
                <p className='text-muted-foreground text-xs'>
                  Acuan nominal: {formatIdr(expectedTreasurerMargin)} (tiket approved + penyesuaian lunas)
                </p>
                <div className='max-w-xs space-y-2'>
                  <Label htmlFor='treasurer-amount'>Nominal transfer</Label>
                  <IdrAmountInput
                    id='treasurer-amount'
                    value={treasurerAmount}
                    onValueChange={setTreasurerAmount}
                    disabled={isPending}
                  />
                </div>
                <div className='flex max-w-lg flex-col gap-3 sm:flex-row sm:items-end'>
                  <div className='min-w-0 flex-1'>
                    <FileField
                      key={`tr-${treasurerFieldKey}`}
                      id={`settlement-treasurer-${treasurerFieldKey}`}
                      label='Berkas bukti'
                      accept='image/jpeg,image/png,image/webp,image/heic,image/heif'
                      disabled={isPending}
                      pickPrompt='Ketuk untuk memilih bukti'
                      replacePrompt='Ganti bukti'
                      onChange={setTreasurerFile}
                    />
                  </div>
                  <Button
                    type='button'
                    className='shrink-0'
                    disabled={isPending}
                    onClick={() =>
                      handleRequestUpload(EventSettlementArtifactKind.treasurer_margin, treasurerFile, treasurerAmount)
                    }
                  >
                    Unggah
                  </Button>
                </div>
              </section>
            </>
          ) : (
            <p className='text-muted-foreground text-sm'>
              Hanya PIC acara atau Owner/Admin yang dapat menambah bukti baru. Riwayat di bawah tetap dapat dibaca.
            </p>
          )}

          <div className='space-y-2'>
            <h3 className='text-sm font-medium'>Riwayat unggahan</h3>
            {artifacts.length === 0 ? (
              <p className='text-muted-foreground text-sm'>Belum ada bukti yang diunggah.</p>
            ) : (
              <div className='overflow-x-auto rounded-md border'>
                <table className='w-full min-w-[640px] text-left text-sm'>
                  <thead className='bg-muted/50 border-b'>
                    <tr>
                      <th className='p-2 font-medium'>Waktu</th>
                      <th className='p-2 font-medium'>Jenis</th>
                      <th className='p-2 font-medium'>Nominal</th>
                      <th className='p-2 font-medium'>Δ acuan</th>
                      <th className='p-2 font-medium'>Alasan selisih</th>
                      <th className='p-2 font-medium'>Oleh</th>
                      <th className='p-2 font-medium'>Bukti</th>
                    </tr>
                  </thead>
                  <tbody>
                    {artifacts.map(a => (
                      <tr key={a.id} className='border-b last:border-0'>
                        <td className='p-2 whitespace-nowrap font-mono text-xs'>
                          {new Date(a.createdAt).toLocaleString('id-ID')}
                        </td>
                        <td className='p-2'>{KIND_LABEL[a.kind]}</td>
                        <td className='p-2 font-mono tabular-nums'>
                          {a.declaredAmountIdr == null ? '—' : formatIdr(a.declaredAmountIdr)}
                        </td>
                        <td className='p-2 font-mono tabular-nums text-xs'>
                          {a.amountDeltaIdr == null ? '—' : formatIdr(a.amountDeltaIdr)}
                        </td>
                        <td className='p-2 max-w-[200px] truncate text-xs'>{a.mismatchReason ?? '—'}</td>
                        <td className='p-2 text-xs'>{a.uploaderLabel}</td>
                        <td className='p-2'>
                          <a
                            href={a.blobUrl}
                            target='_blank'
                            rel='noopener noreferrer'
                            className='text-primary underline underline-offset-2'
                          >
                            Lihat
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={mismatchOpen} onOpenChange={setMismatchOpen}>
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>Selisih dari acuan laporan</DialogTitle>
            <DialogDescription>
              Nominal yang Anda masukkan berbeda lebih dari {formatIdr(SETTLEMENT_AMOUNT_TOLERANCE_IDR)} dari angka
              acuan. Konfirmasi dan jelaskan agar bukti tetap dapat disimpan.
            </DialogDescription>
          </DialogHeader>
          <div className='space-y-3 py-2'>
            <div className='flex items-center gap-2'>
              <Checkbox checked={mismatchAck} onCheckedChange={v => setMismatchAck(v === true)} />
              <Label className='text-sm font-normal'>
                Saya mengonfirmasi selisih ini disengaja dan alasan di bawah benar.
              </Label>
            </div>
            <div className='space-y-1'>
              <Label htmlFor='mismatch-reason'>Alasan selisih</Label>
              <Textarea
                id='mismatch-reason'
                value={mismatchReason}
                onChange={e => setMismatchReason(e.target.value)}
                rows={4}
                placeholder='Contoh: pembulatan ke rekening venue, transfer bertahap, koreksi manual…'
              />
            </div>
          </div>
          <DialogFooter>
            <Button type='button' variant='outline' onClick={() => setMismatchOpen(false)} disabled={isPending}>
              Batal
            </Button>
            <Button type='button' onClick={confirmMismatchUpload} disabled={isPending}>
              Unggah dengan konfirmasi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
