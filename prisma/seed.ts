/**
 * Default database seeder — memuat snapshot dari `prisma/seed-data/*.json`.
 *
 * Terapkan ke DB (setelah migrate + auth:migrate):
 *   pnpm db:seed
 *
 * Snapshot JSON (`prisma/seed-data/*.json`) gitignored — hanya ada di mesin lokal.
 */
import 'dotenv/config'

import { prisma } from '@/lib/db/prisma'
import { loadSeedJson, reviveDates } from './seed-data/load-seed-json'

/** Snapshot JSON → input Prisma upsert (bentuk dicek di runtime, bukan compile time). */
const seedData = (row: Record<string, unknown>) => row as never

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

async function main() {
  console.log('Seed: memuat prisma/seed-data/ …')

  await seedRows('user', loadSeedJson('user'), row =>
    prisma.user.upsert({
      where: { id: row.id as string },
      create: seedData(row),
      update: seedData(row),
    }),
  )

  await seedRows('account', loadSeedJson('account'), row =>
    prisma.account.upsert({
      where: { id: row.id as string },
      create: seedData(row),
      update: seedData(row),
    }),
  )

  await seedRows('twoFactor', loadSeedJson('twoFactor'), row =>
    prisma.twoFactor.upsert({
      where: { id: row.id as string },
      create: seedData(row),
      update: seedData(row),
    }),
  )

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

  await seedRows('adminProfile', loadSeedJson('adminProfile'), row =>
    prisma.adminProfile.upsert({
      where: { authUserId: row.authUserId as string },
      create: seedData(row),
      update: seedData(row),
    }),
  )

  await seedRows('picBankAccount', loadSeedJson('picBankAccount'), row =>
    prisma.picBankAccount.upsert({
      where: { id: row.id as string },
      create: seedData(row),
      update: seedData(row),
    }),
  )

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

  await seedRows('event', loadSeedJson('event'), row =>
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

  await seedRows('eventPicHelper', loadSeedJson('eventPicHelper'), row =>
    prisma.eventPicHelper.upsert({
      where: {
        eventId_adminProfileId: {
          eventId: row.eventId as string,
          adminProfileId: row.adminProfileId as string,
        },
      },
      create: seedData(row),
      update: seedData(row),
    }),
  )

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

  await seedRows('eventSettlementArtifact', loadSeedJson('eventSettlementArtifact'), row =>
    prisma.eventSettlementArtifact.upsert({
      where: { id: row.id as string },
      create: seedData(row),
      update: seedData(row),
    }),
  )

  await seedRows('adminInvitation', loadSeedJson('adminInvitation'), row =>
    prisma.adminInvitation.upsert({
      where: { tokenHash: row.tokenHash as string },
      create: seedData(row),
      update: seedData(row),
    }),
  )

  await seedRows('emailDeliveryLog', loadSeedJson('emailDeliveryLog'), row =>
    prisma.emailDeliveryLog.upsert({
      where: { id: row.id as string },
      create: seedData(row),
      update: seedData(row),
    }),
  )

  await seedRows('clubAuditLog', loadSeedJson('clubAuditLog'), row =>
    prisma.clubAuditLog.upsert({
      where: { id: row.id as string },
      create: seedData(row),
      update: seedData(row),
    }),
  )

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
