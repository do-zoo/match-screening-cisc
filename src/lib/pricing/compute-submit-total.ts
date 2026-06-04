import type { MemberValidation } from '@prisma/client'

export type HolderInput = {
  memberValidation: MemberValidation
  category: { regularPrice: number; memberPrice: number }
  menuItem?: { price: number; name: string } | null
}

export type SubmitPricingInput = {
  holders: HolderInput[]
}

export type HolderPricingLine = {
  index: number
  isMember: boolean
  ticketPrice: number
  /** Price stored for venue payout reporting only — not added to grandTotal. */
  menuPrice: number | null
}

export type SubmitPricingResult = {
  lines: HolderPricingLine[]
  /** Sum of ticketPrice across all holders (menu excluded). */
  grandTotal: number
}

function resolveIsMember(v: MemberValidation): boolean {
  return v === 'valid' || v === 'overridden'
}

export function computeSubmitTotal(input: SubmitPricingInput): SubmitPricingResult {
  const lines: HolderPricingLine[] = input.holders.map((h, i) => {
    const isMember = resolveIsMember(h.memberValidation)
    const ticketPrice = isMember ? h.category.memberPrice : h.category.regularPrice
    const menuPrice = h.menuItem?.price ?? null
    return { index: i, isMember, ticketPrice, menuPrice }
  })
  const grandTotal = lines.reduce((sum, l) => sum + l.ticketPrice, 0)
  return { lines, grandTotal }
}
