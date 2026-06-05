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

vi.mock('@/lib/actions/lookup-member-for-registration', () => ({
  lookupMemberForRegistration: vi.fn(),
}))

vi.mock('@/lib/members/resolve-master-member-registration-lookup', () => ({
  resolveMasterMemberRegistrationLookup: vi.fn(),
}))

import { lookupMemberForRegistration } from '@/lib/actions/lookup-member-for-registration'
import { resolveMasterMemberRegistrationLookup } from '@/lib/members/resolve-master-member-registration-lookup'
import { prisma } from '@/lib/db/prisma'
import { submitRegistration } from '../submit-registration'

const openEvent = {
  id: 'event-1',
  status: 'active',
  registrationManualClosed: false,
  openRegistrationAt: new Date(Date.now() - 1000),
  closeRegistrationAt: new Date(Date.now() + 86400000),
  requireAllHolderData: true,
  memberAccessMode: 'open' as const,
  ticketCategories: [{ id: 'cat-1', regularPrice: 100000, memberPrice: 80000, maxQtyPerPerson: null, capacity: null }],
}

const validHolder = {
  holderName: 'Member Satu',
  holderWhatsapp: '+6281234567890',
  holderEmail: 'kontak@example.com',
  claimedMemberNumber: '001',
  memberType: 'tangsel' as const,
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
    fd.set(
      'holders',
      JSON.stringify([{ holderName: 'Tester', holderWhatsapp: '+6281234567890', holderEmail: 'test@example.com' }]),
    )
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

  it('menerima 1 holder untuk ticketQty=3 dan membuat 1 holder + 3 tiket di DB', async () => {
    const fd = new FormData()
    fd.set('ticketCategoryId', 'cat-1')
    fd.set('ticketQty', '3')
    fd.set(
      'holders',
      JSON.stringify([
        {
          holderName: 'Pemesan Utama',
          holderWhatsapp: '+6281234567890',
          holderEmail: 'utama@example.com',
          claimedMemberNumber: '',
        },
      ]),
    )

    const r = await submitRegistration('event-1', fd)
    expect(r.ok).toBe(true)

    const createCall = txRegistrationCreate.mock.calls[0]![0] as {
      data: {
        holderDataMode: string
        holders: { create: Array<{ holderName: string; assignedTickets: { create: unknown[] } }> }
      }
    }
    expect(createCall.data.holderDataMode).toBe('primary_only')
    expect(createCall.data.holders.create).toHaveLength(1)
    expect(createCall.data.holders.create[0]!.holderName).toBe('Pemesan Utama')
    expect(createCall.data.holders.create[0]!.assignedTickets.create).toHaveLength(3)
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

    const r = await submitRegistration('event-1', fd)
    expect(r.ok).toBe(false)
  })
})

describe('submitRegistration — memberAccessMode', () => {
  beforeEach(() => {
    vi.mocked(prisma.event.findUnique).mockReset()
    vi.mocked(prisma.registration.count).mockReset()
    vi.mocked(lookupMemberForRegistration).mockReset()
    vi.mocked(resolveMasterMemberRegistrationLookup).mockReset()
    txRegistrationCreate.mockReset()
    txRegistrationCount.mockReset()
    vi.mocked(prisma.registration.count).mockResolvedValue(0)
    txRegistrationCount.mockResolvedValue(0)
    txRegistrationCreate.mockResolvedValue({
      id: 'reg-1',
      holders: [{ id: 'h-1', sortOrder: 1 }],
    })
    vi.mocked(lookupMemberForRegistration).mockResolvedValue({
      status: 'valid',
      fullName: 'Member Satu',
      whatsapp: '6281••••••09',
      email: 'me••••@example.com',
    })
    vi.mocked(resolveMasterMemberRegistrationLookup).mockResolvedValue({
      status: 'valid',
      fullName: 'Member Satu',
      whatsapp: '+6281234567890',
      email: 'kontak@example.com',
    })
  })

  it('menolak non-member pada cisc_members', async () => {
    vi.mocked(prisma.event.findUnique).mockResolvedValue({
      ...openEvent,
      memberAccessMode: 'cisc_members',
    } as never)

    const fd = new FormData()
    fd.set('ticketCategoryId', 'cat-1')
    fd.set('ticketQty', '1')
    fd.set(
      'holders',
      JSON.stringify([
        {
          holderName: 'Guest',
          holderWhatsapp: '+6281234567890',
          holderEmail: 'guest@example.com',
          claimedMemberNumber: '',
        },
      ]),
    )

    const r = await submitRegistration('event-1', fd)
    expect(r.ok).toBe(false)
    if (!r.ok && 'rootError' in r) {
      expect(r.rootError).toContain('khusus member CISC')
    }
  })

  it('menolak regional pada tangsel_only', async () => {
    vi.mocked(prisma.event.findUnique).mockResolvedValue({
      ...openEvent,
      memberAccessMode: 'tangsel_only',
    } as never)

    const fd = new FormData()
    fd.set('ticketCategoryId', 'cat-1')
    fd.set('ticketQty', '1')
    fd.set(
      'holders',
      JSON.stringify([
        {
          holderName: 'Regional',
          holderWhatsapp: '+6281234567890',
          holderEmail: 'regional@example.com',
          claimedMemberNumber: 'R-1',
          memberType: 'regional',
        },
      ]),
    )

    const r = await submitRegistration('event-1', fd)
    expect(r.ok).toBe(false)
  })

  it('menerima tangsel valid pada tangsel_only', async () => {
    vi.mocked(prisma.event.findUnique).mockResolvedValue({
      ...openEvent,
      memberAccessMode: 'tangsel_only',
    } as never)

    const fd = new FormData()
    fd.set('ticketCategoryId', 'cat-1')
    fd.set('ticketQty', '1')
    fd.set('holders', JSON.stringify([validHolder]))

    const r = await submitRegistration('event-1', fd)
    expect(r.ok).toBe(true)
  })

  it('merge WA/email dari direktori saat form tangsel kosong', async () => {
    vi.mocked(prisma.event.findUnique).mockResolvedValue({
      ...openEvent,
      memberAccessMode: 'tangsel_only',
    } as never)

    const fd = new FormData()
    fd.set('ticketCategoryId', 'cat-1')
    fd.set('ticketQty', '1')
    fd.set(
      'holders',
      JSON.stringify([
        {
          holderName: 'Member Satu',
          holderWhatsapp: '',
          holderEmail: '',
          claimedMemberNumber: '001',
          memberType: 'tangsel',
        },
      ]),
    )

    const r = await submitRegistration('event-1', fd)
    expect(r.ok).toBe(true)
    expect(txRegistrationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          contactWhatsapp: '+6281234567890',
          contactEmail: 'kontak@example.com',
        }),
      }),
    )
  })
})
