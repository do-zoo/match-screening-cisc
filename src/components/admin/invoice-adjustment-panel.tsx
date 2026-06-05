'use client'

import { useState, useTransition } from 'react'
import { InvoiceAdjustmentStatus, InvoiceAdjustmentType } from '@prisma/client'
import { ExternalLinkIcon, PlusIcon, ReceiptIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { FileField } from '@/components/ui/file-field'
import { IdrAmountInput } from '@/components/ui/idr-amount-input'
import { formatIdr } from '@/lib/utils/format-idr'
import { RegistrationInvoicePdfButton } from '@/components/admin/registration-invoice-pdf-button'
import { SendInvoiceEmailButton } from '@/components/admin/send-invoice-email-button'
import { buildRegistrationInvoicePdfUrl } from '@/lib/invoices/build-registration-invoice-pdf-url'
import { createInvoiceAdjustment, markAdjustmentPaid, markAdjustmentUnpaid } from '@/lib/actions/invoice-adjustment'
import { uploadAdjustmentProof } from '@/lib/actions/upload-adjustment-proof'
import { toastActionErr, toastCudSuccess } from '@/lib/client/cud-notify'
import { cn } from '@/lib/utils'

type Adjustment = {
  id: string
  type: InvoiceAdjustmentType
  amount: number
  status: InvoiceAdjustmentStatus
  paidAt: Date | null
  createdAt: Date
  uploads: Array<{ id: string; blobUrl: string; bytes: number; createdAt: Date }>
}

type Props = {
  eventId: string
  registrationId: string
  adjustments: Adjustment[]
  contactEmail: string | null
  onUnderpaymentEmailSent?: (adjustmentAmountIdr: number) => void
}

const ADJUSTMENT_TYPE_LABEL: Record<InvoiceAdjustmentType, string> = {
  underpayment: 'Kekurangan bayar',
  other_adjustment: 'Penyesuaian lain',
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  return `${Math.round(bytes / 1024)} KB`
}

export function InvoiceAdjustmentPanel({
  eventId,
  registrationId,
  adjustments,
  contactEmail,
  onUnderpaymentEmailSent,
}: Props) {
  const [isPending, startTransition] = useTransition()
  const [createOpen, setCreateOpen] = useState(false)
  const [amount, setAmount] = useState(0)
  const [createError, setCreateError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [proofFieldKeyByAdjustment, setProofFieldKeyByAdjustment] = useState<Record<string, number>>({})

  function handleCreate() {
    setCreateError(null)
    if (!amount || amount <= 0) {
      setCreateError('Masukkan jumlah yang valid.')
      return
    }
    startTransition(async () => {
      const result = await createInvoiceAdjustment(eventId, {
        registrationId,
        type: InvoiceAdjustmentType.underpayment,
        amount,
      })
      if (!result.ok) {
        toastActionErr(result)
        setCreateError(result.rootError ?? Object.values(result.fieldErrors ?? {}).join(', '))
      } else {
        toastCudSuccess('create', 'Penyesuaian invoice ditambahkan.')
        setCreateOpen(false)
        setAmount(0)
      }
    })
  }

  function handleMarkPaid(adjustmentId: string) {
    setActionError(null)
    startTransition(async () => {
      const result = await markAdjustmentPaid(eventId, adjustmentId)
      if (!result.ok) {
        toastActionErr(result)
        setActionError(result.rootError ?? 'Terjadi kesalahan.')
      } else {
        toastCudSuccess('update', 'Penyesuaian ditandai lunas.')
      }
    })
  }

  function handleMarkUnpaid(adjustmentId: string) {
    setActionError(null)
    startTransition(async () => {
      const result = await markAdjustmentUnpaid(eventId, adjustmentId)
      if (!result.ok) {
        toastActionErr(result)
        setActionError(result.rootError ?? 'Terjadi kesalahan.')
      } else {
        toastCudSuccess('update', 'Penyesuaian ditandai belum lunas.')
      }
    })
  }

  function handleUploadProof(adjustmentId: string, file: File | undefined) {
    if (!file) return
    const formData = new FormData()
    formData.set('adjustmentId', adjustmentId)
    formData.set('file', file)
    setActionError(null)
    startTransition(async () => {
      const result = await uploadAdjustmentProof(eventId, formData)
      if (!result.ok) {
        toastActionErr(result)
        setActionError(result.rootError ?? Object.values(result.fieldErrors ?? {}).join(', '))
      } else {
        toastCudSuccess('update', 'Bukti penyesuaian diunggah.')
        setProofFieldKeyByAdjustment(prev => ({
          ...prev,
          [adjustmentId]: (prev[adjustmentId] ?? 0) + 1,
        }))
      }
    })
  }

  return (
    <div className='grid gap-4'>
      {adjustments.length === 0 && !createOpen ? (
        <div className='flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/10 px-4 py-8 text-center'>
          <ReceiptIcon className='size-7 text-muted-foreground/60' aria-hidden />
          <p className='text-sm text-muted-foreground'>Belum ada penyesuaian invoice.</p>
        </div>
      ) : null}

      {adjustments.length > 0 ? (
        <ul className='grid gap-3'>
          {adjustments.map(adj => {
            const isPaid = adj.status === InvoiceAdjustmentStatus.paid
            return (
              <li
                key={adj.id}
                className={cn(
                  'rounded-lg border p-3',
                  isPaid ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-amber-500/20 bg-amber-500/5',
                )}
              >
                <div className='flex items-start justify-between gap-3'>
                  <div className='min-w-0'>
                    <p className='font-medium tabular-nums'>{formatIdr(adj.amount)}</p>
                    <p className='mt-0.5 text-xs text-muted-foreground'>
                      {ADJUSTMENT_TYPE_LABEL[adj.type] ?? adj.type} ·{' '}
                      {new Date(adj.createdAt).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                  <div className='flex shrink-0 flex-wrap items-center justify-end gap-2'>
                    <RegistrationInvoicePdfButton
                      label='Tagihan'
                      dialogTitle='Pratinjau tagihan penyesuaian'
                      previewUrl={buildRegistrationInvoicePdfUrl({
                        eventId,
                        registrationId,
                        kind: 'adjustment',
                        adjustmentId: adj.id,
                        disposition: 'inline',
                      })}
                      downloadUrl={buildRegistrationInvoicePdfUrl({
                        eventId,
                        registrationId,
                        kind: 'adjustment',
                        adjustmentId: adj.id,
                        disposition: 'attachment',
                      })}
                      variant='ghost'
                    />
                    <span
                      className={cn(
                        'rounded-md px-2 py-0.5 text-xs font-medium',
                        isPaid
                          ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-200'
                          : 'bg-amber-500/15 text-amber-900 dark:text-amber-100',
                      )}
                    >
                      {isPaid ? 'Lunas' : 'Belum lunas'}
                    </span>
                  </div>
                </div>

                {adj.uploads.length > 0 ? (
                  <div className='mt-2 flex flex-wrap gap-2'>
                    {adj.uploads.map(u => (
                      <a
                        key={u.id}
                        href={u.blobUrl}
                        target='_blank'
                        rel='noopener noreferrer'
                        className='inline-flex items-center gap-1 rounded-md border border-border/60 bg-background/60 px-2 py-1 text-xs hover:border-primary/40'
                      >
                        Bukti {formatBytes(u.bytes)}
                        <ExternalLinkIcon className='size-3' aria-hidden />
                      </a>
                    ))}
                  </div>
                ) : null}

                <div className='mt-3 grid gap-2'>
                  <div className='flex flex-wrap gap-2'>
                    {!isPaid ? (
                      <>
                        <Button size='sm' variant='outline' disabled={isPending} onClick={() => handleMarkPaid(adj.id)}>
                          Tandai lunas
                        </Button>
                        {contactEmail ? (
                          <SendInvoiceEmailButton
                            eventId={eventId}
                            registrationId={registrationId}
                            disabled={isPending}
                            onSuccess={() => onUnderpaymentEmailSent?.(adj.amount)}
                          />
                        ) : (
                          <span className='self-center text-xs text-muted-foreground'>
                            Email kontak kosong — tidak dapat kirim tagihan.
                          </span>
                        )}
                      </>
                    ) : (
                      <Button size='sm' variant='ghost' disabled={isPending} onClick={() => handleMarkUnpaid(adj.id)}>
                        Batalkan lunas
                      </Button>
                    )}
                  </div>
                  <FileField
                    key={`adj-proof-${adj.id}-${proofFieldKeyByAdjustment[adj.id] ?? 0}`}
                    id={`invoice-adj-proof-${adj.id}`}
                    label='Bukti penyesuaian'
                    description='Unggah foto bukti pembayaran tambahan (opsional).'
                    accept='image/jpeg,image/png,image/webp,image/heic,image/heif'
                    disabled={isPending}
                    pickPrompt='Pilih bukti'
                    replacePrompt='Ganti bukti'
                    onChange={f => {
                      if (f) handleUploadProof(adj.id, f)
                    }}
                  />
                </div>
              </li>
            )
          })}
        </ul>
      ) : null}

      {actionError ? <p className='text-sm text-destructive'>{actionError}</p> : null}

      {!createOpen ? (
        <Button
          variant='outline'
          size='sm'
          className='self-start gap-1.5'
          onClick={() => setCreateOpen(true)}
          disabled={isPending}
        >
          <PlusIcon className='size-4' aria-hidden />
          Tambah penyesuaian
        </Button>
      ) : (
        <div className='grid gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3'>
          <p className='text-sm font-medium'>Tambah kekurangan pembayaran</p>
          <IdrAmountInput value={amount} onValueChange={setAmount} placeholder='Rp0' disabled={isPending} />
          {createError ? <p className='text-sm text-destructive'>{createError}</p> : null}
          <div className='flex flex-wrap gap-2'>
            <Button size='sm' onClick={handleCreate} disabled={isPending}>
              Buat penyesuaian
            </Button>
            <Button
              size='sm'
              variant='outline'
              disabled={isPending}
              onClick={() => {
                setCreateOpen(false)
                setAmount(0)
                setCreateError(null)
              }}
            >
              Batal
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
