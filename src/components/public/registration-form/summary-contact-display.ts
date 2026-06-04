import type { SubmitRegistrationInput } from '@/lib/forms/submit-registration-schema'
import { maskDisplayEmail, maskDisplayWhatsapp } from './mask-contact-display'
import type { HolderValidationResult } from './use-holder-member-validation'

type Holder = SubmitRegistrationInput['holders'][number]

export function resolveHolderContactDisplay(
  holder: Holder,
  validation: HolderValidationResult,
): {
  memberNumber: string | null
  whatsapp: string | null
  email: string | null
} {
  const memberNumber = holder.claimedMemberNumber?.trim() || null

  const whatsapp =
    holder.holderWhatsapp?.trim() ?
      maskDisplayWhatsapp(holder.holderWhatsapp)
    : holder.memberType === 'tangsel' && validation.status === 'valid' ?
      validation.whatsapp
    : null

  const email =
    holder.holderEmail?.trim() ?
      maskDisplayEmail(holder.holderEmail)
    : holder.memberType === 'tangsel' && validation.status === 'valid' ?
      validation.email
    : null

  return { memberNumber, whatsapp, email }
}

export function buildDisplayHolders(
  holders: Holder[],
  ticketQty: number,
  requireAllHolderData: boolean,
): Holder[] {
  if (requireAllHolderData) return holders
  const primary =
    holders[0] ?? {
      holderName: '',
      holderWhatsapp: '',
      holderEmail: '',
      claimedMemberNumber: '',
      mandatoryMenuItemId: '',
    }
  return Array.from({ length: ticketQty }, () => primary)
}
