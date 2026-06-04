'use server'

import { guardOwnerOrAdmin, isAuthError } from '@/lib/actions/guard'
import { ok, rootError, type ActionResult } from '@/lib/forms/action-result'
import { verifyDescriptionAssetEventId } from '@/lib/public/description-asset-token'
import { isUploadError } from '@/lib/uploads/errors'
import { uploadEventDescriptionAssetImage } from '@/lib/uploads/upload-event-description-image'

export async function uploadEventDescriptionImage(
  eventId: string,
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<{ url: string }>> {
  try {
    await guardOwnerOrAdmin()
  } catch (e) {
    if (isAuthError(e)) return rootError('Tidak diizinkan.')
    throw e
  }

  if (!eventId || typeof eventId !== 'string') {
    return rootError('Acara tidak valid.')
  }

  const tokenRaw = formData.get('token')
  const token = typeof tokenRaw === 'string' ? tokenRaw : ''

  if (!verifyDescriptionAssetEventId(eventId, token)) {
    return rootError('Token unggah tidak valid. Muat ulang halaman lalu coba lagi.')
  }

  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) {
    return rootError('Pilih berkas gambar.')
  }

  try {
    const { url } = await uploadEventDescriptionAssetImage({ eventId, file })
    return ok({ url })
  } catch (e) {
    if (isUploadError(e)) return rootError(e.message)
    throw e
  }
}
