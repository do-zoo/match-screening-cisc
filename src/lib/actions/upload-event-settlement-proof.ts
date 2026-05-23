'use server'

import { randomUUID } from 'node:crypto'

import { EventSettlementArtifactKind, UploadPurpose } from '@prisma/client'
import { del } from '@vercel/blob'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { assertCanManageEventSettlement } from '@/lib/actions/guard-event-settlement'
import { guardEvent, isAuthError } from '@/lib/actions/guard'
import { fieldError, ok, rootError, type ActionResult } from '@/lib/forms/action-result'
import { prisma } from '@/lib/db/prisma'
import { getEventReport } from '@/lib/reports/queries'
import { getSettlementExpectedAmounts, settlementAmountMismatch } from '@/lib/reports/settlement-expected-amounts'
import { putWebpToBlob } from '@/lib/uploads/blob'
import { toWebp } from '@/lib/uploads/images'
import { retry } from '@/lib/uploads/retry'
import { parseIdrDigitsToInt } from '@/lib/utils/idr-input'

const MAX_BYTES = 8 * 1024 * 1024
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])

const MISMATCH_REASON_MAX = 2000

const kindSchema = z.nativeEnum(EventSettlementArtifactKind)

const UPLOAD_PURPOSE_BY_KIND: Record<EventSettlementArtifactKind, UploadPurpose> = {
  [EventSettlementArtifactKind.venue_transfer]: UploadPurpose.event_settlement_venue_transfer,
  [EventSettlementArtifactKind.venue_receipt]: UploadPurpose.event_settlement_venue_receipt,
  [EventSettlementArtifactKind.treasurer_margin]: UploadPurpose.event_settlement_treasurer_margin,
}

function uploadPurposeForKind(kind: EventSettlementArtifactKind): UploadPurpose {
  return UPLOAD_PURPOSE_BY_KIND[kind]
}

export async function uploadEventSettlementProof(
  eventId: string,
  formData: FormData,
): Promise<ActionResult<{ artifactId: string }>> {
  let ctx
  try {
    ctx = await guardEvent(eventId)
    await assertCanManageEventSettlement(eventId, ctx)
  } catch (e) {
    if (isAuthError(e)) return rootError('Tidak diizinkan.')
    throw e
  }

  const kindRaw = String(formData.get('kind') ?? '').trim()
  const kindParsed = kindSchema.safeParse(kindRaw)
  if (!kindParsed.success) {
    return fieldError({ kind: 'Jenis bukti tidak valid.' })
  }
  const kind = kindParsed.data

  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) {
    return fieldError({ file: 'Pilih file bukti (gambar).' })
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return fieldError({
      file: 'Format file tidak didukung (JPEG/PNG/WebP/HEIC).',
    })
  }
  if (file.size > MAX_BYTES) {
    return fieldError({ file: 'File terlalu besar (maksimal 8 MB).' })
  }

  const declaredRaw = String(formData.get('declaredAmountIdr') ?? '').trim()
  const declaredAmountIdr = kind === EventSettlementArtifactKind.venue_receipt ? null : parseIdrDigitsToInt(declaredRaw)

  if (kind !== EventSettlementArtifactKind.venue_receipt && (declaredAmountIdr === null || declaredAmountIdr < 0)) {
    return fieldError({ declaredAmountIdr: 'Nominal wajib diisi (IDR).' })
  }

  const report = await getEventReport(eventId)
  const expectedMap = getSettlementExpectedAmounts({
    baselineTotalApproved: report.finance.baselineTotal,
    menuVenuePayoutApproved: report.finance.menuVenuePayoutApproved,
    adjustmentsPaidTotal: report.finance.adjustmentsPaidTotal,
  })

  let expectedAmountIdr: number | null = null
  let amountDeltaIdr: number | null = null
  let mismatchAcknowledged = false
  let mismatchReason: string | null = null

  if (kind === EventSettlementArtifactKind.venue_transfer) {
    expectedAmountIdr = expectedMap.venueMenuPayout
    const declared = declaredAmountIdr ?? 0
    const { delta, withinTolerance } = settlementAmountMismatch(declared, expectedAmountIdr)
    amountDeltaIdr = delta
    const rawAck = String(formData.get('mismatchAcknowledged') ?? '') === 'true'
    const rawReason = String(formData.get('mismatchReason') ?? '').trim()
    if (!withinTolerance) {
      mismatchAcknowledged = rawAck
      mismatchReason = rawReason
      if (!mismatchAcknowledged || mismatchReason.length < 3) {
        return rootError('Nominal berbeda dari acuan laporan. Centang konfirmasi dan isi alasan (minimal 3 karakter).')
      }
      if (mismatchReason.length > MISMATCH_REASON_MAX) {
        return fieldError({
          mismatchReason: `Alasan terlalu panjang (maksimal ${MISMATCH_REASON_MAX} karakter).`,
        })
      }
    }
  } else if (kind === EventSettlementArtifactKind.treasurer_margin) {
    expectedAmountIdr = expectedMap.treasurerMargin
    const declared = declaredAmountIdr ?? 0
    const { delta, withinTolerance } = settlementAmountMismatch(declared, expectedAmountIdr)
    amountDeltaIdr = delta
    const rawAck = String(formData.get('mismatchAcknowledged') ?? '') === 'true'
    const rawReason = String(formData.get('mismatchReason') ?? '').trim()
    if (!withinTolerance) {
      mismatchAcknowledged = rawAck
      mismatchReason = rawReason
      if (!mismatchAcknowledged || mismatchReason.length < 3) {
        return rootError('Nominal berbeda dari acuan laporan. Centang konfirmasi dan isi alasan (minimal 3 karakter).')
      }
      if (mismatchReason.length > MISMATCH_REASON_MAX) {
        return fieldError({
          mismatchReason: `Alasan terlalu panjang (maksimal ${MISMATCH_REASON_MAX} karakter).`,
        })
      }
    }
  }

  const raw = Buffer.from(await file.arrayBuffer())
  const webp = await toWebp(raw, { maxDim: 1600, quality: 80 })
  const blobPath = `events/${eventId}/settlement/${randomUUID()}.webp`

  const putRes = await retry(() => putWebpToBlob({ path: blobPath, bytes: webp.bytes }), {
    maxAttempts: 3,
    delayMs: 250,
  })

  let uploadRow: { id: string } | undefined
  let artifactRow
  try {
    uploadRow = await prisma.upload.create({
      data: {
        purpose: uploadPurposeForKind(kind),
        blobUrl: putRes.url,
        blobPath: putRes.pathname,
        contentType: 'image/webp',
        bytes: webp.bytes.length,
        sha256: webp.sha256,
        width: webp.width,
        height: webp.height,
        originalFilename: file.name,
      },
      select: { id: true },
    })
    artifactRow = await prisma.eventSettlementArtifact.create({
      data: {
        eventId,
        kind,
        declaredAmountIdr,
        expectedAmountIdr,
        amountDeltaIdr,
        mismatchAcknowledged,
        mismatchReason:
          mismatchReason && mismatchReason.length > 0 ? mismatchReason.slice(0, MISMATCH_REASON_MAX) : null,
        uploadedByAdminProfileId: ctx.profileId,
        uploadId: uploadRow.id,
      },
      select: { id: true },
    })
  } catch (err) {
    try {
      await del(putRes.url)
    } catch {
      /* best-effort */
    }
    if (uploadRow) {
      try {
        await prisma.upload.delete({ where: { id: uploadRow.id } })
      } catch {
        /* best-effort */
      }
    }
    throw err
  }

  revalidatePath(`/admin/events/${eventId}/report`)
  return ok({ artifactId: artifactRow.id })
}
