'use client'

import { useEffect, useRef, useState } from 'react'
import { lookupMemberForRegistration, type MemberLookupResult } from '@/lib/actions/lookup-member-for-registration'

export type HolderValidationResult =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'not_found' }
  | { status: 'already_registered' }
  | { status: 'valid'; fullName: string; whatsapp: string | null }

/** Maps validation result to the MemberValidation string used for pricing. */
export function validationToPricing(
  result: HolderValidationResult,
): 'valid' | 'invalid' | 'unknown' {
  if (result.status === 'valid') return 'valid'
  if (result.status === 'not_found') return 'invalid'
  return 'unknown'
}

const DEBOUNCE_MS = 400

export function useHolderMemberValidation(
  claimedMemberNumber: string | undefined,
  eventId: string,
): HolderValidationResult {
  const [result, setResult] = useState<HolderValidationResult>({ status: 'idle' })
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const trimmed = (claimedMemberNumber ?? '').trim()

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)

    // Skip empty values or URLs (browser extension auto-fill artefacts)
    if (!trimmed || trimmed.includes('://')) {
      setResult({ status: 'idle' })
      return
    }

    setResult({ status: 'checking' })
    let cancelled = false

    timerRef.current = setTimeout(async () => {
      try {
        const res: MemberLookupResult = await lookupMemberForRegistration(trimmed, eventId)
        if (!cancelled) setResult(res)
      } catch {
        if (!cancelled) setResult({ status: 'idle' })
      }
    }, DEBOUNCE_MS)

    return () => {
      cancelled = true
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [trimmed, eventId])

  return result
}
