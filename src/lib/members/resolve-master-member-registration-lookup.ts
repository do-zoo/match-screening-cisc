import { RegistrationStatus } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'

export type MasterMemberRegistrationLookup =
  | { status: 'not_found' }
  | { status: 'already_registered' }
  | { status: 'valid'; fullName: string; whatsapp: string | null; email: string | null }

const ACTIVE_STATUSES: RegistrationStatus[] = [
  RegistrationStatus.submitted,
  RegistrationStatus.pending_review,
  RegistrationStatus.approved,
]

/** Resolves member directory row for registration (plaintext — server-side only). */
export async function resolveMasterMemberRegistrationLookup(
  memberNumber: string,
  eventId: string,
  options?: { excludeRegistrationId?: string },
): Promise<MasterMemberRegistrationLookup> {
  const trimmed = memberNumber.trim()
  if (!trimmed) return { status: 'not_found' }

  const excludeRegistrationId = options?.excludeRegistrationId?.trim()

  const [member, duplicate] = await Promise.all([
    prisma.masterMember.findUnique({
      where: { memberNumber: trimmed },
      select: { id: true, fullName: true, whatsapp: true, email: true },
    }),
    prisma.registrationHolder.findFirst({
      where: {
        claimedMemberNumber: trimmed,
        registration: {
          eventId,
          ...(excludeRegistrationId ? { id: { not: excludeRegistrationId } } : {}),
          status: { in: ACTIVE_STATUSES },
        },
      },
      select: { id: true },
    }),
  ])

  if (!member) return { status: 'not_found' }
  if (duplicate) return { status: 'already_registered' }
  return {
    status: 'valid',
    fullName: member.fullName,
    whatsapp: member.whatsapp,
    email: member.email,
  }
}
