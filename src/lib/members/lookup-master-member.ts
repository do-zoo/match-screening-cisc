import { prisma } from '@/lib/db/prisma'

import { normalizeMemberNumber } from './normalize-member-number'

/**
 * Active directory row for a member number, or null if unknown/inactive.
 * Used by registration submit and public partner-eligibility lookup.
 */
export type ActiveMasterMemberRow = {
  /** Nilai persis di kolom DB (sumber kanonis untuk penyimpanan & konsistensi direktori). */
  memberNumber: string
  isManagementMember: boolean
  fullName: string
  whatsapp: string | null
}

export async function getActiveMasterMemberByMemberNumber(memberNumber: string): Promise<ActiveMasterMemberRow | null> {
  const normalized = normalizeMemberNumber(memberNumber)
  if (!normalized) return null

  return prisma.masterMember.findFirst({
    where: {
      isActive: true,
      memberNumber: {
        equals: normalized,
        mode: 'insensitive',
      },
    },
    select: {
      memberNumber: true,
      isManagementMember: true,
      fullName: true,
      whatsapp: true,
    },
  })
}
