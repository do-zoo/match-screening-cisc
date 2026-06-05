import { createHash } from 'node:crypto'

const SEED_ID_PREFIX = /^seed_/i

/** Cuid stabil dari ID snapshot lama — upsert seed tetap idempotent. */
export function cuidFromLegacySeedId(legacyId: string): string {
  const digest = createHash('sha256').update(legacyId).digest('base64url').replace(/[^a-z0-9]/gi, '0')
  return (`c${digest}`).slice(0, 25).padEnd(25, '0')
}

function remapValue(value: unknown, remap: Map<string, string>): unknown {
  if (typeof value !== 'string') return value
  return remap.get(value) ?? value
}

/**
 * Ganti ID / FK ber-prefix `seed_` pada baris registrasi, holder, dan tiket.
 * Dipanggil sebelum upsert bila snapshot lokal masih memuat ID migrasi lama.
 */
export function normalizeRegistrationSnapshotRow<T extends Record<string, unknown>>(
  row: T,
  kind: 'registration' | 'registrationHolder' | 'registrationTicket',
  remap: Map<string, string>,
): T {
  const out: Record<string, unknown> = { ...row }

  if (typeof out.id === 'string' && SEED_ID_PREFIX.test(out.id)) {
    if (!remap.has(out.id)) {
      remap.set(out.id, cuidFromLegacySeedId(out.id))
    }
    out.id = remap.get(out.id)
  }

  if (kind === 'registrationHolder' || kind === 'registrationTicket') {
    out.registrationId = remapValue(out.registrationId, remap)
  }

  if (kind === 'registrationTicket') {
    out.assignedHolderId = remapValue(out.assignedHolderId, remap)
  }

  return out as T
}

export function rowHasLegacySeedId(row: Record<string, unknown>): boolean {
  for (const value of Object.values(row)) {
    if (typeof value === 'string' && SEED_ID_PREFIX.test(value)) return true
  }
  return false
}

/** Bersihkan metadata audit `CISC-SEED-*` → format nomor member alami. */
export function normalizeClubAuditLogMetadata(row: Record<string, unknown>): Record<string, unknown> {
  const metadata = row.metadata
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return row

  const meta = { ...(metadata as Record<string, unknown>) }
  const memberNumber = meta.memberNumber
  if (typeof memberNumber === 'string' && /CISC-SEED-/i.test(memberNumber)) {
    const suffix = memberNumber.replace(/^CISC-SEED-/i, '').padStart(10, '0')
    meta.memberNumber = `CISC9${suffix.slice(-10)}`
  }

  return { ...row, metadata: meta }
}
