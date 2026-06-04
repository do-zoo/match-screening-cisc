'use server'

import {
  maskDisplayEmail,
  maskDisplayWhatsapp,
} from '@/lib/members/mask-member-contact-display'
import { resolveMasterMemberRegistrationLookup } from '@/lib/members/resolve-master-member-registration-lookup'

export type MemberLookupResult =
  | { status: 'not_found' }
  | { status: 'already_registered' }
  | { status: 'valid'; fullName: string; whatsapp: string | null; email: string | null }

export async function lookupMemberForRegistration(memberNumber: string, eventId: string): Promise<MemberLookupResult> {
  const result = await resolveMasterMemberRegistrationLookup(memberNumber, eventId)
  if (result.status !== 'valid') return result

  return {
    status: 'valid',
    fullName: result.fullName,
    whatsapp: result.whatsapp ? maskDisplayWhatsapp(result.whatsapp) : null,
    email: result.email ? maskDisplayEmail(result.email) : null,
  }
}
