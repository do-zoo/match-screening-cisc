import { describe, expect, it, vi, beforeEach } from 'vitest'
import { RegistrationStatus } from '@prisma/client'

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    registration: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}))

vi.mock('@/lib/uploads/upload-image', () => ({
  uploadImageForRegistration: vi.fn(),
}))

import { prisma } from '@/lib/db/prisma'
import { uploadImageForRegistration } from '@/lib/uploads/upload-image'
import { UploadError } from '@/lib/uploads/errors'
import { uploadTransferProof } from '../upload-transfer-proof'

const mockFindUnique = vi.mocked(prisma.registration.findUnique)
const mockUpdate = vi.mocked(prisma.registration.update)
const mockUpload = vi.mocked(uploadImageForRegistration)

describe('uploadTransferProof', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('mengembalikan error jika tidak ada file', async () => {
    const fd = new FormData()
    const r = await uploadTransferProof('reg-1', fd)
    expect(r.ok).toBe(false)
    if (!r.ok && 'rootError' in r) expect(r.rootError).toMatch(/wajib/)
  })

  it('mengembalikan error jika registration tidak ditemukan', async () => {
    mockFindUnique.mockResolvedValue(null)
    const fd = new FormData()
    fd.append('transferProof', new File(['x'], 'proof.jpg', { type: 'image/jpeg' }))
    const r = await uploadTransferProof('reg-1', fd)
    expect(r.ok).toBe(false)
    if (!r.ok && 'rootError' in r) expect(r.rootError).toMatch(/tidak ditemukan/)
  })

  it('mengembalikan error jika status bukan submitted', async () => {
    mockFindUnique.mockResolvedValue({ id: 'reg-1', status: RegistrationStatus.pending_review } as never)
    const fd = new FormData()
    fd.append('transferProof', new File(['x'], 'proof.jpg', { type: 'image/jpeg' }))
    const r = await uploadTransferProof('reg-1', fd)
    expect(r.ok).toBe(false)
    if (!r.ok && 'rootError' in r) expect(r.rootError).toMatch(/tidak dapat/)
  })

  it('mengembalikan error jika upload gagal', async () => {
    mockFindUnique.mockResolvedValue({ id: 'reg-1', status: RegistrationStatus.submitted } as never)
    mockUpload.mockRejectedValue(new UploadError('File too large.', { code: 'file_too_large', recoverable: true }))
    const fd = new FormData()
    fd.append('transferProof', new File(['x'], 'proof.jpg', { type: 'image/jpeg' }))
    const r = await uploadTransferProof('reg-1', fd)
    expect(r.ok).toBe(false)
    if (!r.ok && 'rootError' in r) expect(r.rootError).toMatch(/Gagal mengunggah/)
  })

  it('upload berhasil dan status naik ke pending_review', async () => {
    mockFindUnique.mockResolvedValue({ id: 'reg-1', status: RegistrationStatus.submitted } as never)
    mockUpload.mockResolvedValue({ uploadId: 'u1', url: 'https://example.com/proof.webp' })
    mockUpdate.mockResolvedValue({ id: 'reg-1' } as never)
    const fd = new FormData()
    fd.append('transferProof', new File(['x'], 'proof.jpg', { type: 'image/jpeg' }))
    const r = await uploadTransferProof('reg-1', fd)
    expect(r.ok).toBe(true)
    expect(mockUpload).toHaveBeenCalledWith({
      purpose: 'transfer_proof',
      registrationId: 'reg-1',
      file: expect.any(File),
    })
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'reg-1' },
      data: { status: RegistrationStatus.pending_review },
    })
  })
})
