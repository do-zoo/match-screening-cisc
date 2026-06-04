import type { MemberAccessMode } from '@prisma/client'

export const MEMBER_ACCESS_MODE_BADGE: Record<MemberAccessMode, string | null> = {
  open: null,
  tangsel_only: 'Khusus member Tangsel',
  cisc_members: 'Khusus member CISC',
}

export const MEMBER_ACCESS_MODE_BANNER: Record<MemberAccessMode, string | null> = {
  open: null,
  tangsel_only: 'Acara ini khusus member CISC Tangsel. Daftar dengan nomor anggota yang terdaftar di direktori.',
  cisc_members: 'Acara ini khusus member CISC. Non-member tidak dapat mendaftar.',
}

export function isMemberOnlyAccessMode(mode: MemberAccessMode): boolean {
  return mode !== 'open'
}

export function allowedMemberTypesForMode(
  mode: MemberAccessMode,
): Array<'tangsel' | 'regional'> | 'all' {
  if (mode === 'open') return 'all'
  if (mode === 'tangsel_only') return ['tangsel']
  return ['tangsel', 'regional']
}

type HolderEligibilityInput = {
  memberType?: 'tangsel' | 'regional' | null
  claimedMemberNumber?: string | null
}

export function assertHolderEligibleForMemberAccessMode(
  holder: HolderEligibilityInput,
  mode: MemberAccessMode,
  tangselLookupValid = false,
): { ok: true } | { ok: false; message: string } {
  if (mode === 'open') return { ok: true }

  if (mode === 'cisc_members') {
    if (!holder.memberType) {
      return { ok: false, message: 'Acara ini khusus member CISC. Pilih status keanggotaan member saat mendaftar.' }
    }
    return { ok: true }
  }

  if (holder.memberType !== 'tangsel' || !holder.claimedMemberNumber?.trim()) {
    return {
      ok: false,
      message: 'Acara ini khusus member CISC Tangsel. Nomor anggota wajib terdaftar di direktori.',
    }
  }
  if (!tangselLookupValid) {
    return {
      ok: false,
      message: 'Acara ini khusus member CISC Tangsel. Nomor anggota wajib terdaftar di direktori.',
    }
  }
  return { ok: true }
}
