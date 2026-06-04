'use client'

import { useEffect, useRef, useState } from 'react'
import { lookupMemberForRegistration, type MemberLookupResult } from '@/lib/actions/lookup-member-for-registration'

export type HolderValidationResult =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'not_found' }
  | { status: 'already_registered' }
  | { status: 'valid'; fullName: string; whatsapp: string | null; email: string | null }

/** Maps validation result to the MemberValidation string used for pricing. */
export function validationToPricing(result: HolderValidationResult): 'valid' | 'invalid' | 'unknown' {
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
  const resolvedKeyRef = useRef<string | null>(null)
  const trimmed = (claimedMemberNumber ?? '').trim()
  const skipLookup = !trimmed || trimmed.includes('://')
  const lookupKey = skipLookup ? null : `${trimmed}:${eventId}`

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (!lookupKey) return

    let cancelled = false

    timerRef.current = setTimeout(async () => {
      try {
        const res: MemberLookupResult = await lookupMemberForRegistration(trimmed, eventId)
        if (!cancelled) {
          resolvedKeyRef.current = lookupKey
          setResult(res)
        }
      } catch {
        if (!cancelled) {
          resolvedKeyRef.current = lookupKey
          setResult({ status: 'idle' })
        }
      }
    }, DEBOUNCE_MS)

    return () => {
      cancelled = true
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [lookupKey, trimmed, eventId])

  if (skipLookup) return { status: 'idle' }
  if (lookupKey !== resolvedKeyRef.current) return { status: 'checking' }
  return result
}
