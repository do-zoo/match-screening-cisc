import 'dotenv/config'

import { AdminRole, EventStatus } from '@prisma/client'

/** Same Neon + `db.localtest.me` proxy setup as the app (`scripts/bootstrap-admin` pattern). */
import { prisma } from '@/lib/db/prisma'

// Stable ID prefix untuk EventTicketCategory — agar upsert idempoten
const CAT_PIALA_PLAYER = 'seed_cat_piala_player'
const CAT_PIALA_GK = 'seed_cat_piala_gk'
const CAT_SCREENING_PRESALE = 'seed_cat_screening_presale'
const CAT_SCREENING_OTS = 'seed_cat_screening_ots'

/** Jendela registrasi vs gate vs kick-off untuk seed acara. */
function eventTiming(start: Date, end: Date) {
  const openRegistrationAt = new Date(start.getTime() - 14 * 24 * 60 * 60 * 1000)
  const closeRegistrationAt = new Date(start.getTime() - 60 * 60 * 1000)
  const openGateAt = new Date(start.getTime() - 30 * 60 * 1000)
  return {
    openRegistrationAt,
    closeRegistrationAt,
    openGateAt,
    kickOffAt: end,
  }
}

/** Kombinasi isActive × isManagementMember — untuk variasi direktori (tanpa PIC di member). */
type MasterMemberSeed = {
  memberNumber: string
  fullName: string
  isActive: boolean
  isManagementMember: boolean
  whatsapp?: string | null
  /** Jika diisi, buat ManagementMember dengan publicCode ini dan tautkan ke MasterMember. */
  managementPublicCode?: string
}

const MASTER_MEMBER_SEEDS: MasterMemberSeed[] = [
  {
    memberNumber: 'CISC-DEMO-PIC-1',
    fullName: 'Dimas Purnomo',
    isActive: true,
    isManagementMember: true,
    whatsapp: '+6281380013800',
    managementPublicCode: 'DEMO-PIC',
  },
  {
    memberNumber: 'CISC-SEED-110',
    fullName: 'Rina Kusuma',
    isActive: true,
    isManagementMember: true,
    managementPublicCode: 'SEED-A',
  },
  {
    memberNumber: 'CISC-SEED-101',
    fullName: 'Dewi Lestari',
    isActive: true,
    isManagementMember: false,
  },
  {
    memberNumber: 'CISC-SEED-100',
    fullName: 'Agus Prasetyo',
    isActive: true,
    isManagementMember: false,
  },
  {
    memberNumber: 'CISC-SEED-011',
    fullName: 'Hendra Gunawan',
    isActive: false,
    isManagementMember: true,
    managementPublicCode: 'SEED-B',
  },
  {
    memberNumber: 'CISC-SEED-010',
    fullName: 'Maya Anggraini',
    isActive: false,
    isManagementMember: true,
    managementPublicCode: 'SEED-C',
  },
  {
    memberNumber: 'CISC-SEED-001',
    fullName: 'Bambang Hartono',
    isActive: false,
    isManagementMember: false,
  },
  {
    memberNumber: 'CISC-SEED-000',
    fullName: 'Lina Wijaya',
    isActive: false,
    isManagementMember: false,
  },
]

async function main() {
  for (const row of MASTER_MEMBER_SEEDS) {
    const whatsapp = row.whatsapp === undefined ? undefined : (row.whatsapp ?? null)
    await prisma.masterMember.upsert({
      where: { memberNumber: row.memberNumber },
      update: {
        fullName: row.fullName,
        isActive: row.isActive,
        isManagementMember: row.isManagementMember,
        ...(whatsapp !== undefined ? { whatsapp } : {}),
      },
      create: {
        memberNumber: row.memberNumber,
        fullName: row.fullName,
        isActive: row.isActive,
        isManagementMember: row.isManagementMember,
        ...(whatsapp !== undefined ? { whatsapp } : {}),
      },
    })
  }

  // Upsert ManagementMember records for every seed that has a publicCode.
  // Each is linked to its MasterMember via masterMemberId.
  for (const row of MASTER_MEMBER_SEEDS) {
    if (!row.managementPublicCode) continue
    const master = await prisma.masterMember.findUnique({
      where: { memberNumber: row.memberNumber },
      select: { id: true },
    })
    if (!master) continue
    await prisma.managementMember.upsert({
      where: { publicCode: row.managementPublicCode },
      update: { fullName: row.fullName, masterMemberId: master.id },
      create: {
        publicCode: row.managementPublicCode,
        fullName: row.fullName,
        masterMemberId: master.id,
        ...(row.whatsapp ? { whatsapp: row.whatsapp } : {}),
      },
    })
  }

  const ownerProfile = await prisma.adminProfile.findFirst({
    where: { role: AdminRole.Owner },
    orderBy: { createdAt: 'asc' },
  })

  if (!ownerProfile) {
    console.warn('Seed: lewati acara — tidak ada AdminProfile Owner. Jalankan bootstrap admin terlebih dahulu.')
    return
  }

  // Link owner admin profile to the DEMO-PIC ManagementMember if not already linked.
  if (!ownerProfile.managementMemberId) {
    const demoPicMember = await prisma.managementMember.findUnique({
      where: { publicCode: 'DEMO-PIC' },
      select: { id: true },
    })
    if (demoPicMember) {
      await prisma.adminProfile.update({
        where: { id: ownerProfile.id },
        data: { managementMemberId: demoPicMember.id },
      })
    }
  }

  const existingBank = await prisma.picBankAccount.findFirst({
    where: {
      ownerAdminProfileId: ownerProfile.id,
      accountNumber: '1234567890',
    },
  })
  const bank = existingBank
    ? await prisma.picBankAccount.update({
        where: { id: existingBank.id },
        data: {
          bankName: 'BCA',
          accountName: 'Demo CISC Tangsel',
          isActive: true,
        },
      })
    : await prisma.picBankAccount.create({
        data: {
          ownerAdminProfileId: ownerProfile.id,
          bankName: 'BCA',
          accountNumber: '1234567890',
          accountName: 'Demo CISC Tangsel',
          isActive: true,
        },
      })

  // Hapus acara demo lama bila masih ada (tidak ada registrasi)
  const OLD_SLUGS = ['demo-final-ucl-2026', 'demo-kopdar-catalog-2026']
  for (const slug of OLD_SLUGS) {
    const oldEvent = await prisma.event.findUnique({ where: { slug }, select: { id: true } })
    if (!oldEvent) continue
    const regCount = await prisma.registration.count({ where: { eventId: oldEvent.id } })
    if (regCount > 0) {
      console.warn(`Seed: lewati hapus acara lama "${slug}" — ada ${regCount} registrasi.`)
      continue
    }
    await prisma.eventTicketCategory.deleteMany({ where: { eventId: oldEvent.id } })
    await prisma.eventVenueMenuItem.deleteMany({ where: { eventId: oldEvent.id } })
    await prisma.event.delete({ where: { id: oldEvent.id } })
    console.log(`Seed: acara lama "${slug}" dihapus.`)
  }

  // Hapus venue demo lama bila tidak direferensikan acara mana pun
  const OLD_VENUE_IDS = ['cm_seed_venue_demo_final', 'cm_seed_venue_catalog_wide']
  for (const venueId of OLD_VENUE_IDS) {
    const venue = await prisma.venue.findUnique({ where: { id: venueId }, select: { id: true } })
    if (!venue) continue
    const eventCount = await prisma.event.count({ where: { venueId } })
    if (eventCount > 0) continue
    await prisma.venueMenuItem.deleteMany({ where: { venueId } })
    await prisma.venue.delete({ where: { id: venueId } })
    console.log(`Seed: venue lama "${venueId}" dihapus.`)
  }

  // ─── Venue 1: VAR POINT MINI SOCCER ─────────────────────────────────────────
  const VAR_POINT_VENUE_ID = 'cm_seed_venue_var_point_ciputat'

  const varPointVenue = await prisma.venue.upsert({
    where: { id: VAR_POINT_VENUE_ID },
    update: {
      name: 'VAR POINT MINI SOCCER',
      address: 'Jl. Serua Raya, Kec. Ciputat, Tangsel 15414',
      isActive: true,
    },
    create: {
      id: VAR_POINT_VENUE_ID,
      name: 'VAR POINT MINI SOCCER',
      address: 'Jl. Serua Raya, Kec. Ciputat, Tangsel 15414',
      isActive: true,
    },
  })

  // Bersihkan menu venue lama sebelum recreate
  const varPointOldMenuIds = await prisma.venueMenuItem.findMany({
    where: { venueId: varPointVenue.id },
    select: { id: true },
  })
  if (varPointOldMenuIds.length > 0) {
    await prisma.eventVenueMenuItem.deleteMany({
      where: { venueMenuItemId: { in: varPointOldMenuIds.map(r => r.id) } },
    })
    await prisma.venueMenuItem.deleteMany({ where: { venueId: varPointVenue.id } })
  }

  const vmAirMineral = await prisma.venueMenuItem.create({
    data: { venueId: varPointVenue.id, name: 'Air Mineral', price: 0, sortOrder: 1 },
  })

  // ─── Venue 2: BENTO KOPI CIPUTAT ─────────────────────────────────────────────
  const BENTO_KOPI_VENUE_ID = 'cm_seed_venue_bento_kopi_ciputat'

  const bentoKopiVenue = await prisma.venue.upsert({
    where: { id: BENTO_KOPI_VENUE_ID },
    update: {
      name: 'Bento Kopi Ciputat',
      address: 'Ciputat, Tangerang Selatan',
      isActive: true,
    },
    create: {
      id: BENTO_KOPI_VENUE_ID,
      name: 'Bento Kopi Ciputat',
      address: 'Ciputat, Tangerang Selatan',
      isActive: true,
    },
  })

  // Bersihkan menu venue lama sebelum recreate
  const bentoKopiOldMenuIds = await prisma.venueMenuItem.findMany({
    where: { venueId: bentoKopiVenue.id },
    select: { id: true },
  })
  if (bentoKopiOldMenuIds.length > 0) {
    await prisma.eventVenueMenuItem.deleteMany({
      where: { venueMenuItemId: { in: bentoKopiOldMenuIds.map(r => r.id) } },
    })
    await prisma.venueMenuItem.deleteMany({ where: { venueId: bentoKopiVenue.id } })
  }

  const vmSoftDrink = await prisma.venueMenuItem.create({
    data: { venueId: bentoKopiVenue.id, name: 'Soft Drink', price: 0, sortOrder: 1 },
  })

  // ─── Acara 1: Piala Digilir "VII" (Mini Soccer) ──────────────────────────────
  const pialaStart = new Date('2026-06-07T15:30:00+07:00')
  const pialaEnd = new Date('2026-06-07T18:00:00+07:00')
  const pialaTiming = eventTiming(pialaStart, pialaEnd)

  const pialaSummary = 'Mini Soccer Piala Digilir "VII" bersama CISC Tangsel — daftarkan diri sebagai Player atau GK.'
  const pialaDescription =
    '<p>HTM termasuk jersey inventaris, air mineral, dan dokumentasi.</p><p>CP: IAN +628 57-4027-5213</p>'

  const pialaEvent = await prisma.event.upsert({
    where: { slug: 'piala-digilir-vii-2026' },
    update: {
      title: 'Piala Digilir "VII" (Mini Soccer)',
      bankAccountId: bank.id,
      picAdminProfileId: ownerProfile.id,
      venueId: varPointVenue.id,
      summary: pialaSummary,
      description: pialaDescription,
      ...pialaTiming,
      mandatoryMenuItemIds: [vmAirMineral.id],
      registrationManualClosed: false,
      multiCategoryPurchase: false,
      status: EventStatus.active,
      coverBlobUrl: 'https://placehold.co/1200x630/034694/ffffff/png?text=Piala+Digilir+VII',
      coverBlobPath: '__seed__/piala-digilir-vii-2026/cover.webp',
    },
    create: {
      slug: 'piala-digilir-vii-2026',
      title: 'Piala Digilir "VII" (Mini Soccer)',
      summary: pialaSummary,
      description: pialaDescription,
      ...pialaTiming,
      mandatoryMenuItemIds: [vmAirMineral.id],
      coverBlobUrl: 'https://placehold.co/1200x630/034694/ffffff/png?text=Piala+Digilir+VII',
      coverBlobPath: '__seed__/piala-digilir-vii-2026/cover.webp',
      registrationManualClosed: false,
      multiCategoryPurchase: false,
      venueId: varPointVenue.id,
      status: EventStatus.active,
      picAdminProfileId: ownerProfile.id,
      bankAccountId: bank.id,
    },
  })

  await prisma.eventVenueMenuItem.deleteMany({ where: { eventId: pialaEvent.id } })
  await prisma.eventVenueMenuItem.createMany({
    data: [{ eventId: pialaEvent.id, venueMenuItemId: vmAirMineral.id, sortOrder: 1 }],
  })

  await prisma.eventTicketCategory.upsert({
    where: { id: CAT_PIALA_PLAYER },
    update: {
      name: 'Player',
      regularPrice: 85_000,
      memberPrice: 70_000,
      maxQtyPerPerson: null,
      sortOrder: 1,
      isActive: true,
    },
    create: {
      id: CAT_PIALA_PLAYER,
      eventId: pialaEvent.id,
      name: 'Player',
      regularPrice: 85_000,
      memberPrice: 70_000,
      maxQtyPerPerson: null,
      sortOrder: 1,
      isActive: true,
    },
  })
  await prisma.eventTicketCategory.upsert({
    where: { id: CAT_PIALA_GK },
    update: {
      name: 'GK (Kiper)',
      regularPrice: 70_000,
      memberPrice: 55_000,
      maxQtyPerPerson: null,
      sortOrder: 2,
      isActive: true,
    },
    create: {
      id: CAT_PIALA_GK,
      eventId: pialaEvent.id,
      name: 'GK (Kiper)',
      regularPrice: 70_000,
      memberPrice: 55_000,
      maxQtyPerPerson: null,
      sortOrder: 2,
      isActive: true,
    },
  })

  // ─── Acara 2: Match Screening — Crystal Palace vs Chelsea ────────────────────
  // KO 21:00 WIB; open gate 20:30 WIB → openGateAt = kickOffAt - 30 min via eventTiming
  const screeningKO = new Date('2026-01-25T21:00:00+07:00')
  const screeningEnd = new Date('2026-01-25T23:30:00+07:00')
  const screeningTiming = eventTiming(screeningKO, screeningEnd)

  const screeningSummary = 'Nobar Chelsea bareng CISC — Crystal Palace vs Chelsea, Premier League GW22.'
  const screeningDescription =
    '<p>HTM termasuk soft drink dan merchandise. Presale lebih hemat — daftar sekarang!</p><p>CP: EDO — 0811 9821 309</p>'

  const screeningEvent = await prisma.event.upsert({
    where: { slug: 'match-screening-cpfc-cfc-gw22' },
    update: {
      title: 'Match Screening — Crystal Palace vs Chelsea',
      bankAccountId: bank.id,
      picAdminProfileId: ownerProfile.id,
      venueId: bentoKopiVenue.id,
      summary: screeningSummary,
      description: screeningDescription,
      ...screeningTiming,
      mandatoryMenuItemIds: [vmSoftDrink.id],
      registrationManualClosed: false,
      multiCategoryPurchase: false,
      status: EventStatus.active,
      coverBlobUrl: 'https://placehold.co/1200x630/001489/ffffff/png?text=Match+Screening+CPFC+vs+CFC',
      coverBlobPath: '__seed__/match-screening-cpfc-cfc-gw22/cover.webp',
    },
    create: {
      slug: 'match-screening-cpfc-cfc-gw22',
      title: 'Match Screening — Crystal Palace vs Chelsea',
      summary: screeningSummary,
      description: screeningDescription,
      ...screeningTiming,
      mandatoryMenuItemIds: [vmSoftDrink.id],
      coverBlobUrl: 'https://placehold.co/1200x630/001489/ffffff/png?text=Match+Screening+CPFC+vs+CFC',
      coverBlobPath: '__seed__/match-screening-cpfc-cfc-gw22/cover.webp',
      registrationManualClosed: false,
      multiCategoryPurchase: false,
      venueId: bentoKopiVenue.id,
      status: EventStatus.active,
      picAdminProfileId: ownerProfile.id,
      bankAccountId: bank.id,
    },
  })

  await prisma.eventVenueMenuItem.deleteMany({ where: { eventId: screeningEvent.id } })
  await prisma.eventVenueMenuItem.createMany({
    data: [{ eventId: screeningEvent.id, venueMenuItemId: vmSoftDrink.id, sortOrder: 1 }],
  })

  await prisma.eventTicketCategory.upsert({
    where: { id: CAT_SCREENING_PRESALE },
    update: {
      name: 'Presale',
      regularPrice: 30_000,
      memberPrice: 25_000,
      maxQtyPerPerson: null,
      sortOrder: 1,
      isActive: true,
    },
    create: {
      id: CAT_SCREENING_PRESALE,
      eventId: screeningEvent.id,
      name: 'Presale',
      regularPrice: 30_000,
      memberPrice: 25_000,
      maxQtyPerPerson: null,
      sortOrder: 1,
      isActive: true,
    },
  })
  await prisma.eventTicketCategory.upsert({
    where: { id: CAT_SCREENING_OTS },
    update: {
      name: 'OTS (On The Spot)',
      regularPrice: 35_000,
      memberPrice: 30_000,
      maxQtyPerPerson: null,
      sortOrder: 2,
      isActive: true,
    },
    create: {
      id: CAT_SCREENING_OTS,
      eventId: screeningEvent.id,
      name: 'OTS (On The Spot)',
      regularPrice: 35_000,
      memberPrice: 30_000,
      maxQtyPerPerson: null,
      sortOrder: 2,
      isActive: true,
    },
  })

  const mgmtCount = MASTER_MEMBER_SEEDS.filter(r => r.managementPublicCode).length
  console.log(
    'Seed OK:',
    pialaEvent.slug,
    `(${2} kategori tiket: Player + GK) +`,
    screeningEvent.slug,
    `(${2} kategori tiket: Presale + OTS)`,
    `· venue mini soccer=${varPointVenue.id} · venue nobar=${bentoKopiVenue.id}`,
    `(${MASTER_MEMBER_SEEDS.length} MasterMember · ${mgmtCount} ManagementMember · PIC = Owner ${ownerProfile.id})`,
  )
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async e => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
