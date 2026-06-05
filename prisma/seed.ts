/**
 * Default database seeder — memuat snapshot dari `prisma/seed-data/*.json`.
 *
 * Akun admin (Better Auth + AdminProfile) **tidak** di-seed di sini.
 * Buat lewat `pnpm bootstrap:admin` setelah `pnpm auth:migrate`.
 *
 * Urutan lokal yang disarankan:
 *   pnpm db:migrate:dev && pnpm auth:migrate && pnpm bootstrap:admin -- … && pnpm db:seed
 *
 * Snapshot JSON (`prisma/seed-data/*.json`) gitignored — hanya ada di mesin lokal.
 */
import 'dotenv/config'

import { prisma } from '@/lib/db/prisma'
import { loadSeedJson, reviveDates } from './seed-data/load-seed-json'

/** Snapshot JSON → input Prisma upsert (bentuk dicek di runtime, bukan compile time). */
const seedData = (row: Record<string, unknown>) => row as never

const ADMIN_PROFILE_ID_FIELDS = [
  'ownerAdminProfileId',
  'picAdminProfileId',
  'adminProfileId',
  'uploadedByAdminProfileId',
  'actorAdminProfileId',
] as const

async function resolveBootstrapAdminProfileId(): Promise<string | null> {
  const owner = await prisma.adminProfile.findFirst({
    where: { role: 'Owner' },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  })
  if (owner) return owner.id

  const anyAdmin = await prisma.adminProfile.findFirst({
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  })
  return anyAdmin?.id ?? null
}

const ADMIN_SNAPSHOT_TABLES = [
  'picBankAccount',
  'event',
  'eventPicHelper',
  'eventSettlementArtifact',
  'emailDeliveryLog',
  'clubAuditLog',
] as const

/** ID profil admin dari snapshot lokal → profil hasil `bootstrap:admin`. */
function buildAdminProfileIdRemap(bootstrapAdminProfileId: string): Map<string, string> {
  const snapshotIds = new Set<string>()

  for (const row of loadSeedJson('adminProfile')) {
    if (typeof row.id === 'string') snapshotIds.add(row.id)
  }

  for (const table of ADMIN_SNAPSHOT_TABLES) {
    for (const row of loadSeedJson(table)) {
      for (const field of ADMIN_PROFILE_ID_FIELDS) {
        const value = row[field]
        if (typeof value === 'string') snapshotIds.add(value)
      }
    }
  }

  const remap = new Map<string, string>()
  for (const id of snapshotIds) {
    remap.set(id, bootstrapAdminProfileId)
  }
  remap.set(bootstrapAdminProfileId, bootstrapAdminProfileId)
  return remap
}

function remapAdminProfileIds<T extends Record<string, unknown>>(
  row: T,
  remap: Map<string, string>,
): T {
  const out: Record<string, unknown> = { ...row }
  for (const field of ADMIN_PROFILE_ID_FIELDS) {
    const value = out[field]
    if (typeof value === 'string' && remap.has(value)) {
      out[field] = remap.get(value)
    }
  }
  return out as T
}

async function seedRows<T extends Record<string, unknown>>(
  label: string,
  rows: T[],
  upsert: (row: T) => Promise<unknown>,
) {
  for (const row of rows) {
    await upsert(reviveDates(row))
  }
  if (rows.length > 0) {
    console.log(`  ${label}: ${rows.length}`)
  }
}

async function seedRowsWithAdminRemap<T extends Record<string, unknown>>(
  label: string,
  rows: T[],
  remap: Map<string, string>,
  upsert: (row: T) => Promise<unknown>,
) {
  for (const row of rows) {
    await upsert(remapAdminProfileIds(reviveDates(row), remap))
  }
  if (rows.length > 0) {
    console.log(`  ${label}: ${rows.length}`)
  }
}

async function main() {
  console.log('Seed: memuat prisma/seed-data/ …')

  const bootstrapAdminProfileId = await resolveBootstrapAdminProfileId()
  const adminRemap = bootstrapAdminProfileId
    ? buildAdminProfileIdRemap(bootstrapAdminProfileId)
    : null

  if (!bootstrapAdminProfileId) {
    console.warn(
      '  admin: dilewati — jalankan `pnpm bootstrap:admin` dulu agar baris yang butuh AdminProfile dapat dimuat.',
    )
  } else {
    console.log(`  admin: memetakan ID snapshot → bootstrap (${bootstrapAdminProfileId})`)
  }

  await seedRows('masterMember', loadSeedJson('masterMember'), row =>
    prisma.masterMember.upsert({
      where: { memberNumber: row.memberNumber as string },
      create: seedData(row),
      update: seedData(row),
    }),
  )

  await seedRows('boardPeriod', loadSeedJson('boardPeriod'), row =>
    prisma.boardPeriod.upsert({
      where: { id: row.id as string },
      create: seedData(row),
      update: seedData(row),
    }),
  )

  await seedRows('boardRole', loadSeedJson('boardRole'), row =>
    prisma.boardRole.upsert({
      where: { id: row.id as string },
      create: seedData(row),
      update: seedData(row),
    }),
  )

  await seedRows('managementMember', loadSeedJson('managementMember'), row =>
    prisma.managementMember.upsert({
      where: { publicCode: row.publicCode as string },
      create: seedData(row),
      update: seedData(row),
    }),
  )

  await seedRows('boardAssignment', loadSeedJson('boardAssignment'), row =>
    prisma.boardAssignment.upsert({
      where: { id: row.id as string },
      create: seedData(row),
      update: seedData(row),
    }),
  )

  if (adminRemap) {
    await seedRowsWithAdminRemap('picBankAccount', loadSeedJson('picBankAccount'), adminRemap, row =>
      prisma.picBankAccount.upsert({
        where: { id: row.id as string },
        create: seedData(row),
        update: seedData(row),
      }),
    )
  }

  await seedRows('venue', loadSeedJson('venue'), row =>
    prisma.venue.upsert({
      where: { id: row.id as string },
      create: seedData(row),
      update: seedData(row),
    }),
  )

  await seedRows('venueMenuItem', loadSeedJson('venueMenuItem'), row =>
    prisma.venueMenuItem.upsert({
      where: { id: row.id as string },
      create: seedData(row),
      update: seedData(row),
    }),
  )

  await seedRows('clubBranding', loadSeedJson('clubBranding'), row =>
    prisma.clubBranding.upsert({
      where: { singletonKey: row.singletonKey as string },
      create: seedData(row),
      update: seedData(row),
    }),
  )

  await seedRows('clubOperationalSettings', loadSeedJson('clubOperationalSettings'), row =>
    prisma.clubOperationalSettings.upsert({
      where: { singletonKey: row.singletonKey as string },
      create: seedData(row),
      update: seedData(row),
    }),
  )

  await seedRows('clubNotificationPreferences', loadSeedJson('clubNotificationPreferences'), row =>
    prisma.clubNotificationPreferences.upsert({
      where: { singletonKey: row.singletonKey as string },
      create: seedData(row),
      update: seedData(row),
    }),
  )

  await seedRows('clubWaTemplate', loadSeedJson('clubWaTemplate'), row =>
    prisma.clubWaTemplate.upsert({
      where: { key: row.key as never },
      create: seedData(row),
      update: seedData(row),
    }),
  )

  await seedRows('clubEmailTemplate', loadSeedJson('clubEmailTemplate'), row =>
    prisma.clubEmailTemplate.upsert({
      where: { key: row.key as never },
      create: seedData(row),
      update: seedData(row),
    }),
  )

  if (adminRemap) {
    await seedRowsWithAdminRemap('event', loadSeedJson('event'), adminRemap, row =>
      prisma.event.upsert({
        where: { slug: row.slug as string },
        create: seedData(row),
        update: seedData(row),
      }),
    )

    await seedRows('eventTicketCategory', loadSeedJson('eventTicketCategory'), row =>
      prisma.eventTicketCategory.upsert({
        where: { id: row.id as string },
        create: seedData(row),
        update: seedData(row),
      }),
    )

    await seedRows('eventVenueMenuItem', loadSeedJson('eventVenueMenuItem'), row =>
      prisma.eventVenueMenuItem.upsert({
        where: {
          eventId_venueMenuItemId: {
            eventId: row.eventId as string,
            venueMenuItemId: row.venueMenuItemId as string,
          },
        },
        create: seedData(row),
        update: seedData(row),
      }),
    )

    const helperRows = loadSeedJson('eventPicHelper')
    const seenHelpers = new Set<string>()
    let helperCount = 0
    for (const raw of helperRows) {
      const row = remapAdminProfileIds(reviveDates(raw), adminRemap)
      const key = `${row.eventId as string}:${row.adminProfileId as string}`
      if (seenHelpers.has(key)) continue
      seenHelpers.add(key)
      await prisma.eventPicHelper.upsert({
        where: {
          eventId_adminProfileId: {
            eventId: row.eventId as string,
            adminProfileId: row.adminProfileId as string,
          },
        },
        create: seedData(row),
        update: seedData(row),
      })
      helperCount++
    }
    if (helperCount > 0) {
      console.log(`  eventPicHelper: ${helperCount}`)
    }

    await seedRows('registration', loadSeedJson('registration'), row =>
      prisma.registration.upsert({
        where: { id: row.id as string },
        create: seedData(row),
        update: seedData(row),
      }),
    )

    await seedRows('registrationHolder', loadSeedJson('registrationHolder'), row =>
      prisma.registrationHolder.upsert({
        where: { id: row.id as string },
        create: seedData(row),
        update: seedData(row),
      }),
    )

    await seedRows('registrationTicket', loadSeedJson('registrationTicket'), row =>
      prisma.registrationTicket.upsert({
        where: {
          registrationId_sortOrder: {
            registrationId: row.registrationId as string,
            sortOrder: row.sortOrder as number,
          },
        },
        create: seedData(row),
        update: seedData(row),
      }),
    )

    await seedRows('invoiceAdjustment', loadSeedJson('invoiceAdjustment'), row =>
      prisma.invoiceAdjustment.upsert({
        where: { id: row.id as string },
        create: seedData(row),
        update: seedData(row),
      }),
    )

    await seedRows('upload', loadSeedJson('upload'), row =>
      prisma.upload.upsert({
        where: { id: row.id as string },
        create: seedData(row),
        update: seedData(row),
      }),
    )

    await seedRowsWithAdminRemap(
      'eventSettlementArtifact',
      loadSeedJson('eventSettlementArtifact'),
      adminRemap,
      row =>
        prisma.eventSettlementArtifact.upsert({
          where: { id: row.id as string },
          create: seedData(row),
          update: seedData(row),
        }),
    )
  }

  if (adminRemap) {
    await seedRowsWithAdminRemap('emailDeliveryLog', loadSeedJson('emailDeliveryLog'), adminRemap, row =>
      prisma.emailDeliveryLog.upsert({
        where: { id: row.id as string },
        create: seedData(row),
        update: seedData(row),
      }),
    )

    await seedRowsWithAdminRemap('clubAuditLog', loadSeedJson('clubAuditLog'), adminRemap, row =>
      prisma.clubAuditLog.upsert({
        where: { id: row.id as string },
        create: seedData(row),
        update: seedData(row),
      }),
    )
  }

  const { readFileSync, existsSync } = await import('node:fs')
  const { join } = await import('node:path')
  const manifestPath = join(process.cwd(), 'prisma', 'seed-data', 'manifest.json')
  const total = existsSync(manifestPath)
    ? Object.values(JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<string, number>).reduce(
        (a, b) => a + b,
        0,
      )
    : 0
  console.log(`Seed OK (${total} baris dari snapshot lokal)`)
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
