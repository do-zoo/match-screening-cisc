import { del } from '@vercel/blob'

import { putWebpToBlob } from '@/lib/uploads/blob'
import { UploadError } from '@/lib/uploads/errors'
import { toWebp } from '@/lib/uploads/images'
import { retry } from '@/lib/uploads/retry'

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024
const ALLOWED_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])

export async function uploadVenueMenuImage(opts: {
  venueId: string
  menuItemId: string
  file: File
}): Promise<{ url: string; pathname: string }> {
  const { file } = opts
  if (!ALLOWED_IMAGE_MIME_TYPES.has(file.type)) {
    throw new UploadError('Gunakan berkas gambar.', {
      code: 'invalid_content_type',
      recoverable: true,
    })
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new UploadError('Ukuran berkas terlalu besar.', {
      code: 'file_too_large',
      recoverable: true,
    })
  }

  const raw = Buffer.from(await file.arrayBuffer())
  const webp = await toWebp(raw, { maxDim: 1200, quality: 80 })
  const blobPath = `venues/${opts.venueId}/menu/${opts.menuItemId}.webp`

  return retry(() => putWebpToBlob({ path: blobPath, bytes: webp.bytes }), {
    maxAttempts: 3,
    delayMs: 250,
  })
}

export async function deleteVenueMenuImage(blobUrl: string | null | undefined): Promise<void> {
  if (!blobUrl?.startsWith('http')) return
  await del(blobUrl).catch(() => undefined)
}
