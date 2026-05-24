import { describe, expect, it, vi, beforeEach } from 'vitest'

const txRegistrationCreate = vi.fn()
const txRegistrationCount = vi.fn()

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    event: { findUnique: vi.fn() },
    registration: { count: vi.fn() },
    $transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) =>
      cb({ registration: { count: txRegistrationCount, create: txRegistrationCreate } }),
    ),
  },
}))

vi.mock('@/lib/public/load-club-operational-settings', () => ({
  loadClubOperationalSettings: vi.fn().mockResolvedValue({
    registrationGloballyDisabled: false,
    globalRegistrationClosedMessage: null,
  }),
}))

import { prisma } from '@/lib/db/prisma'
import { submitRegistration } from '../submit-registration'

const openEvent = {
  id: 'event-1',
  status: 'active',
  registrationManualClosed: false,
  openRegistrationAt: new Date(Date.now() - 1000),
  closeRegistrationAt: new Date(Date.now() + 86400000),
  registrationCapacity: null,
  requireAllHolderData: true,
  ticketCategories: [
    { id: 'cat-1', regularPrice: 100000, memberPrice: 80000, maxQtyPerPerson: null },
  ],
}

describe('submitRegistration (integrasi ringan / tanpa DB nyata)', () => {
  beforeEach(() => {
    vi.mocked(prisma.event.findUnique).mockReset()
    vi.mocked(prisma.registration.count).mockReset()
    txRegistrationCreate.mockReset()
    txRegistrationCount.mockReset()
    vi.mocked(prisma.registration.count).mockResolvedValue(0)
    txRegistrationCount.mockResolvedValue(0)
    txRegistrationCreate.mockResolvedValue({ id: 'reg-1' })
  })

  it('mengembalikan error jika holders JSON tidak valid', async () => {
    const fd = new FormData()
    fd.set('holders', 'bukan-json')
    const r = await submitRegistration('event-123', fd)
    expect(r.ok).toBe(false)
    if (!r.ok && 'rootError' in r) {
      expect(r.rootError).toBeTruthy()
    }
  })

  it('mengembalikan error jika acara tidak ditemukan', async () => {
    vi.mocked(prisma.event.findUnique).mockResolvedValueOnce(null)
    const fd = new FormData()
    fd.set('ticketCategoryId', 'cat-1')
    fd.set('ticketQty', '1')
    fd.set('holders', JSON.stringify([{ holderName: 'Tester', holderWhatsapp: '+6281234567890' }]))
    fd.set('contactWhatsapp', '+6281234567890')
    const r = await submitRegistration('tidak-ada', fd)
    expect(r.ok).toBe(false)
    if (!r.ok && 'rootError' in r) {
      expect(r.rootError).toBeTruthy()
    }
  })
})

describe('submitRegistration — requireAllHolderData = false (primary-only mode)', () => {
  beforeEach(() => {
    vi.mocked(prisma.event.findUnique).mockReset()
    vi.mocked(prisma.registration.count).mockReset()
    txRegistrationCreate.mockReset()
    txRegistrationCount.mockReset()
    vi.mocked(prisma.registration.count).mockResolvedValue(0)
    txRegistrationCount.mockResolvedValue(0)
    txRegistrationCreate.mockResolvedValue({ id: 'reg-1' })
    vi.mocked(prisma.event.findUnique).mockResolvedValue({
      ...openEvent,
      requireAllHolderData: false,
    } as never)
  })

  it('menerima 1 holder untuk ticketQty=3 dan membuat 3 holder rows di DB', async () => {
    const fd = new FormData()
    fd.set('ticketCategoryId', 'cat-1')
    fd.set('ticketQty', '3')
    fd.set(
      'holders',
      JSON.stringify([{ holderName: 'Pemesan Utama', holderWhatsapp: '+6281234567890', claimedMemberNumber: '' }]),
    )
    fd.set('contactWhatsapp', '+6281234567890')

    const r = await submitRegistration('event-1', fd)
    expect(r.ok).toBe(true)

    const createCall = txRegistrationCreate.mock.calls[0]![0] as {
      data: { holders: { create: unknown[] } }
    }
    expect(createCall.data.holders.create).toHaveLength(3)
    const rows = createCall.data.holders.create as Array<{ holderName: string }>
    expect(rows[0]!.holderName).toBe('Pemesan Utama')
    expect(rows[1]!.holderName).toBe('Pemesan Utama')
    expect(rows[2]!.holderName).toBe('Pemesan Utama')
  })

  it('menolak jika dikirim lebih dari 1 holder saat primary-only mode', async () => {
    const fd = new FormData()
    fd.set('ticketCategoryId', 'cat-1')
    fd.set('ticketQty', '2')
    fd.set(
      'holders',
      JSON.stringify([
        { holderName: 'Holder 1', holderWhatsapp: '+6281234567890' },
        { holderName: 'Holder 2', holderWhatsapp: '+6281234567891' },
      ]),
    )
    fd.set('contactWhatsapp', '+6281234567890')

    const r = await submitRegistration('event-1', fd)
    expect(r.ok).toBe(false)
  })
})
