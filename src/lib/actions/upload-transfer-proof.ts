'use server'

import { RegistrationStatus } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { ok, rootError, type ActionResult } from '@/lib/forms/action-result'
import { uploadImageForRegistration } from '@/lib/uploads/upload-image'
import { isUploadError } from '@/lib/uploads/errors'

export async function uploadTransferProof(
  registrationId: string,
  formData: FormData,
): Promise<ActionResult<null>> {
  const file = formData.get('transferProof')
  if (!(file instanceof File) || file.size === 0) {
    return rootError('Bukti transfer wajib diunggah.')
  }

  const registration = await prisma.registration.findUnique({
    where: { id: registrationId },
    select: { id: true, status: true },
  })

  if (!registration) return rootError('Pendaftaran tidak ditemukan.')
  if (registration.status !== RegistrationStatus.submitted) {
    return rootError('Pendaftaran ini tidak dapat menerima bukti transfer.')
  }

  try {
    await uploadImageForRegistration({
      purpose: 'transfer_proof',
      registrationId,
      file,
    })

    await prisma.registration.update({
      where: { id: registrationId },
      data: { status: RegistrationStatus.pending_review },
    })

    return ok(null)
  } catch (e) {
    if (isUploadError(e)) {
      return rootError('Gagal mengunggah gambar. Coba unggah ulang.')
    }
    console.error(e)
    return rootError('Gagal mengirim bukti transfer. Coba lagi.')
  }
}
