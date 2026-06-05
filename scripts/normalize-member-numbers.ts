import 'dotenv/config'

import { prisma } from '@/lib/db/prisma'
import { normalizeMemberNumber } from '@/lib/members/normalize-member-number'

type MemberUpdate = { id: string; from: string; to: string }

function usage() {
  return [
    'Normalisasi nomor member ke huruf besar (MasterMember + claimedMemberNumber registrasi).',
    '',
    'Dry-run (default):',
    '  pnpm normalize:member-numbers',
    '',
    'Terapkan perubahan:',
    '  pnpm normalize:member-numbers -- --apply',
  ].join('\n')
}

function findMasterMemberConflicts(
  members: Array<{ id: string; memberNumber: string }>,
  pendingUpdates: MemberUpdate[],
): Array<{ normalized: string; rows: Array<{ id: string; memberNumber: string }> }> {
  const pendingById = new Map(pendingUpdates.map(u => [u.id, u.to]))
  const buckets = new Map<string, Array<{ id: string; memberNumber: string }>>()

  for (const member of members) {
    const effective = pendingById.get(member.id) ?? member.memberNumber
    const key = normalizeMemberNumber(effective)
    const bucket = buckets.get(key) ?? []
    bucket.push({ id: member.id, memberNumber: member.memberNumber })
    buckets.set(key, bucket)
  }

  return [...buckets.entries()]
    .filter(([, rows]) => rows.length > 1)
    .map(([normalized, rows]) => ({ normalized, rows }))
}

async function main() {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(usage())
    return
  }

  const apply = process.argv.includes('--apply')

  const [members, holders, registrations] = await Promise.all([
    prisma.masterMember.findMany({ select: { id: true, memberNumber: true } }),
    prisma.registrationHolder.findMany({
      where: { claimedMemberNumber: { not: null } },
      select: { id: true, claimedMemberNumber: true },
    }),
    prisma.registration.findMany({
      where: { claimedMemberNumber: { not: null } },
      select: { id: true, claimedMemberNumber: true },
    }),
  ])

  const memberUpdates: MemberUpdate[] = []
  for (const member of members) {
    const normalized = normalizeMemberNumber(member.memberNumber)
    if (normalized && normalized !== member.memberNumber) {
      memberUpdates.push({ id: member.id, from: member.memberNumber, to: normalized })
    }
  }

  const holderUpdates: MemberUpdate[] = []
  for (const holder of holders) {
    const raw = holder.claimedMemberNumber
    if (!raw) continue
    const normalized = normalizeMemberNumber(raw)
    if (normalized && normalized !== raw) {
      holderUpdates.push({ id: holder.id, from: raw, to: normalized })
    }
  }

  const registrationUpdates: MemberUpdate[] = []
  for (const registration of registrations) {
    const raw = registration.claimedMemberNumber
    if (!raw) continue
    const normalized = normalizeMemberNumber(raw)
    if (normalized && normalized !== raw) {
      registrationUpdates.push({ id: registration.id, from: raw, to: normalized })
    }
  }

  const conflicts = findMasterMemberConflicts(members, memberUpdates)

  console.log('Ringkasan normalisasi nomor member')
  console.log(`- MasterMember: ${memberUpdates.length} baris perlu diperbarui`)
  console.log(`- RegistrationHolder.claimedMemberNumber: ${holderUpdates.length} baris`)
  console.log(`- Registration.claimedMemberNumber: ${registrationUpdates.length} baris`)

  if (memberUpdates.length > 0) {
    console.log('\nContoh MasterMember (maks. 10):')
    for (const row of memberUpdates.slice(0, 10)) {
      console.log(`  ${row.from} → ${row.to}`)
    }
    if (memberUpdates.length > 10) {
      console.log(`  … dan ${memberUpdates.length - 10} baris lainnya`)
    }
  }

  if (conflicts.length > 0) {
    console.error('\nKonflik unik — beberapa anggota akan memakai nomor yang sama setelah normalisasi:')
    for (const conflict of conflicts) {
      console.error(`  ${conflict.normalized}:`)
      for (const row of conflict.rows) {
        console.error(`    - ${row.memberNumber} (${row.id})`)
      }
    }
    console.error('\nSelesaikan konflik manual sebelum menjalankan dengan --apply.')
    process.exit(1)
  }

  const totalChanges = memberUpdates.length + holderUpdates.length + registrationUpdates.length
  if (totalChanges === 0) {
    console.log('\nSemua nomor member sudah sesuai format uppercase.')
    return
  }

  if (!apply) {
    console.log('\nDry-run selesai. Jalankan dengan --apply untuk menulis perubahan ke basis data.')
    return
  }

  await prisma.$transaction(async tx => {
    for (const row of memberUpdates) {
      await tx.masterMember.update({
        where: { id: row.id },
        data: { memberNumber: row.to },
      })
    }
    for (const row of holderUpdates) {
      await tx.registrationHolder.update({
        where: { id: row.id },
        data: { claimedMemberNumber: row.to },
      })
    }
    for (const row of registrationUpdates) {
      await tx.registration.update({
        where: { id: row.id },
        data: { claimedMemberNumber: row.to },
      })
    }
  })

  console.log('\nNormalisasi selesai.')
  console.log(
    `Diperbarui: ${memberUpdates.length} MasterMember, ${holderUpdates.length} holder, ${registrationUpdates.length} registrasi.`,
  )
}

main()
  .catch(e => {
    console.error(e instanceof Error ? e.message : e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
