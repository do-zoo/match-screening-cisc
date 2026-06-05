/**
 * Satu kali (atau ulang): ganti ID registrasi/holder/tiket ber-prefix `seed_` di
 * `prisma/seed-data/*.json` menjadi cuid alami, plus bersihkan metadata audit
 * yang masih memuat `CISC-SEED-*`.
 *
 *   pnpm exec tsx scripts/normalize-seed-registration-ids.ts
 */
import { randomBytes } from 'node:crypto'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const SEED_DATA_DIR = join(process.cwd(), 'prisma', 'seed-data')

function createCuidLike(existing: Set<string>): string {
  for (;;) {
    const t = Date.now().toString(36)
    const r = randomBytes(10).toString('hex')
    const id = (`c${t}${r}`).slice(0, 25).padEnd(25, '0')
    if (!existing.has(id)) {
      existing.add(id)
      return id
    }
  }
}

function loadJsonArray(name: string): Record<string, unknown>[] {
  const path = join(SEED_DATA_DIR, `${name}.json`)
  if (!existsSync(path)) return []
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as unknown
  if (!Array.isArray(parsed)) throw new Error(`${name}.json harus array`)
  return parsed as Record<string, unknown>[]
}

function saveJsonArray(name: string, rows: Record<string, unknown>[]) {
  writeFileSync(join(SEED_DATA_DIR, `${name}.json`), `${JSON.stringify(rows, null, 2)}\n`, 'utf8')
}

function isSeedRegistrationId(value: unknown): value is string {
  return typeof value === 'string' && /^seed_/i.test(value)
}

function remapField(
  row: Record<string, unknown>,
  field: string,
  remap: Map<string, string>,
): void {
  const value = row[field]
  if (typeof value === 'string' && remap.has(value)) {
    row[field] = remap.get(value)
  }
}

function main() {
  const registrations = loadJsonArray('registration')
  const holders = loadJsonArray('registrationHolder')
  const tickets = loadJsonArray('registrationTicket')

  const remap = new Map<string, string>()
  const usedIds = new Set<string>()

  for (const row of registrations) {
    const oldId = row.id
    if (isSeedRegistrationId(oldId)) {
      remap.set(oldId, createCuidLike(usedIds))
    }
  }

  for (const row of holders) {
    const oldId = row.id
    if (isSeedRegistrationId(oldId)) {
      remap.set(oldId, createCuidLike(usedIds))
    }
  }

  for (const row of tickets) {
    const oldId = row.id
    if (isSeedRegistrationId(oldId)) {
      remap.set(oldId, createCuidLike(usedIds))
    }
  }

  if (remap.size === 0) {
    console.log('Tidak ada ID ber-prefix seed_ — tidak ada perubahan registrasi.')
  } else {
    for (const row of registrations) {
      if (isSeedRegistrationId(row.id)) row.id = remap.get(row.id as string)
    }

    for (const row of holders) {
      if (isSeedRegistrationId(row.id)) row.id = remap.get(row.id as string)
      remapField(row, 'registrationId', remap)
    }

    for (const row of tickets) {
      if (isSeedRegistrationId(row.id)) row.id = remap.get(row.id as string)
      remapField(row, 'registrationId', remap)
      remapField(row, 'assignedHolderId', remap)
    }

    saveJsonArray('registration', registrations)
    saveJsonArray('registrationHolder', holders)
    saveJsonArray('registrationTicket', tickets)
    console.log(`ID registrasi/holder/tiket: ${remap.size} dipetakan ke cuid alami.`)
  }

  const auditRows = loadJsonArray('clubAuditLog')
  let auditPatched = 0
  for (const row of auditRows) {
    const metadata = row.metadata
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) continue
    const meta = metadata as Record<string, unknown>
    const memberNumber = meta.memberNumber
    if (typeof memberNumber === 'string' && /CISC-SEED-/i.test(memberNumber)) {
      const suffix = memberNumber.replace(/^CISC-SEED-/i, '').padStart(10, '0')
      meta.memberNumber = `CISC9${suffix.slice(-10)}`
      auditPatched++
    }
  }
  if (auditPatched > 0) {
    saveJsonArray('clubAuditLog', auditRows)
    console.log(`clubAuditLog: ${auditPatched} baris metadata memberNumber dibersihkan.`)
  }

  const remaining = [
    'registration',
    'registrationHolder',
    'registrationTicket',
    'clubAuditLog',
  ].flatMap(name => {
    const raw = readFileSync(join(SEED_DATA_DIR, `${name}.json`), 'utf8')
    const hits = raw.match(/seed_mig|CISC-SEED|seed_/gi) ?? []
    return hits.length ? [`${name}: ${hits.length} sisa`] : []
  })

  if (remaining.length > 0) {
    console.warn('Masih ada pola seed:', remaining.join(', '))
    process.exit(1)
  }

  console.log('Normalisasi selesai — snapshot siap di-seed.')
}

main()
