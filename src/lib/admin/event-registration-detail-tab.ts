import { RegistrationStatus } from '@prisma/client'

import { eventRegistrationDetailPath } from '@/lib/admin/event-registrants-paths'

export type RegistrationDetailTab = 'ringkasan' | 'verifikasi' | 'operasi'

const TABS = new Set<RegistrationDetailTab>(['ringkasan', 'verifikasi', 'operasi'])

function firstString(raw: string | string[] | undefined): string | undefined {
  if (raw === undefined) return undefined
  if (Array.isArray(raw)) return raw[0]
  return raw
}

export function parseRegistrationDetailTab(raw: string | string[] | undefined): RegistrationDetailTab | null {
  const v = firstString(raw)
  if (!v || v.trim() === '') return null
  if (!TABS.has(v as RegistrationDetailTab)) return null
  return v as RegistrationDetailTab
}

export function defaultRegistrationDetailTab(input: {
  status: RegistrationStatus
  hasUnpaidAdjustment: boolean
}): RegistrationDetailTab {
  const { status, hasUnpaidAdjustment } = input

  if (
    status === RegistrationStatus.submitted ||
    status === RegistrationStatus.pending_review ||
    status === RegistrationStatus.payment_issue
  ) {
    return 'verifikasi'
  }

  if (status === RegistrationStatus.approved) {
    return hasUnpaidAdjustment ? 'operasi' : 'ringkasan'
  }

  if (
    status === RegistrationStatus.rejected ||
    status === RegistrationStatus.cancelled ||
    status === RegistrationStatus.refunded
  ) {
    return 'ringkasan'
  }

  return 'ringkasan'
}

export function buildRegistrationDetailPath(
  eventId: string,
  registrationId: string,
  tab?: RegistrationDetailTab,
): string {
  const base = eventRegistrationDetailPath(eventId, registrationId)
  if (tab === undefined) return base
  return `${base}?tab=${tab}`
}
