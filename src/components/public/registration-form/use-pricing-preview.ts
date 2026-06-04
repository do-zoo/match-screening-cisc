'use client'

import { useMemo } from 'react'
import { computeSubmitTotal } from '@/lib/pricing/compute-submit-total'
import type { HolderInput } from '@/lib/forms/submit-registration-schema'

type CategoryPricing = {
  regularPrice: number
  memberPrice: number
}

type UsePricingPreviewArgs = {
  category: CategoryPricing | undefined
  holders: HolderInput[]
  holderValidations: ('valid' | 'invalid' | 'unknown')[]
  forceMemberPricing?: boolean
}

export function usePricingPreview({
  category,
  holders,
  holderValidations,
  forceMemberPricing = false,
}: UsePricingPreviewArgs) {
  return useMemo(() => {
    if (!category || holders.length === 0) return null
    return computeSubmitTotal({
      holders: holders.map((h, i) => ({
        memberValidation: forceMemberPricing ? 'valid' : (holderValidations[i] ?? 'unknown'),
        category: {
          regularPrice: category.regularPrice,
          memberPrice: category.memberPrice,
        },
      })),
    })
  }, [category, holders, holderValidations, forceMemberPricing])
}
