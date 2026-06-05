import { normalizeStoredEmail } from '@/lib/email/normalize-email'

import { interpretMasterMemberCsvBoolean } from './master-member-csv-boolean'
import { normalizeMemberNumber } from './normalize-member-number'

export type MasterMemberCsvWritablePatch = {
  fullName?: string
  whatsapp?: string | null
  email?: string | null
  isActive?: boolean
}

export type PreparedMasterMemberCsvRow =
  | {
      tag: 'duplicate'
      lineNumberPhysical: number
      memberNumber: string
      firstLineNumber: number
    }
  | { tag: 'reject'; lineNumberPhysical: number; reasons: string[] }
  | {
      tag: 'ok'
      lineNumberPhysical: number
      canonicalMemberNumber: string
      patch: MasterMemberCsvWritablePatch
      requiresFullNameForCreate: boolean
    }

/**
 * @param memberNumberFirstLine — `new Map()`; diisi `normalizeMemberNumber(member_number)` → baris pertama file untuk nomor itu.
 */
export function prepareMasterMemberCsvRow(
  lineNumberPhysical: number,
  cells: Record<string, string>,
  memberNumberFirstLine: Map<string, number>,
): PreparedMasterMemberCsvRow {
  const rawNum = (cells.member_number ?? '').trim()
  if (!rawNum) {
    return {
      tag: 'reject',
      lineNumberPhysical,
      reasons: ['Nomor member wajib.'],
    }
  }

  const canonicalMemberNumber = normalizeMemberNumber(rawNum)
  const firstLineNumber = memberNumberFirstLine.get(canonicalMemberNumber)
  if (firstLineNumber !== undefined) {
    return {
      tag: 'duplicate',
      lineNumberPhysical,
      memberNumber: canonicalMemberNumber,
      firstLineNumber,
    }
  }
  memberNumberFirstLine.set(canonicalMemberNumber, lineNumberPhysical)

  const patch: MasterMemberCsvWritablePatch = {}
  const nameTrim = (cells.full_name ?? '').trim()
  if (nameTrim) patch.fullName = nameTrim

  const waTrim = (cells.whatsapp ?? '').trim()
  if (waTrim) patch.whatsapp = waTrim

  const emailTrim = (cells.email ?? '').trim()
  if (emailTrim) {
    try {
      patch.email = normalizeStoredEmail(emailTrim)
    } catch {
      return {
        tag: 'reject',
        lineNumberPhysical,
        reasons: ['Format email tidak valid.'],
      }
    }
  }

  const active = interpretMasterMemberCsvBoolean(cells.is_active)
  if (active !== undefined) patch.isActive = active
  return {
    tag: 'ok',
    lineNumberPhysical,
    canonicalMemberNumber,
    patch,
    requiresFullNameForCreate: !nameTrim,
  }
}
