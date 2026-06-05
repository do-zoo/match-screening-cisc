import type { HolderInput } from '@/lib/forms/submit-registration-schema'
import type { MasterMemberRegistrationLookup } from '@/lib/members/resolve-master-member-registration-lookup'

export function mergeTangselHolderContact(
  form: HolderInput,
  lookup: Extract<MasterMemberRegistrationLookup, { status: 'valid' }>,
): HolderInput {
  return {
    ...form,
    holderName: form.holderName?.trim() || lookup.fullName,
    holderWhatsapp: form.holderWhatsapp?.trim() || lookup.whatsapp?.trim() || '',
    holderEmail: form.holderEmail?.trim() || lookup.email?.trim() || '',
  }
}
