import type { ReactNode } from 'react'

import { applyEmailPlaceholders } from '@/lib/email-templates/email-placeholder'
import type { EmailSummaryDataRow, TransactionSummaryParts } from '@/lib/email-templates/emails/club-email-summary-card'
import {
  EVENT_SUMMARY_CARD_TITLE,
  renderTransactionSummaryCard,
  summaryPartsToPlainLines,
} from '@/lib/email-templates/emails/club-email-summary-card'

export { EVENT_SUMMARY_CARD_TITLE }

/** Ringkasan acara: nama, venue, lokasi, dan waktu — kartu terpisah dari ringkasan pesanan. */
export function buildEventScheduleParts(vars: Record<string, string>): TransactionSummaryParts | null {
  const rows: EmailSummaryDataRow[] = []
  if (vars.event_title?.trim()) {
    rows.push({
      label: 'Nama acara',
      value: applyEmailPlaceholders('{event_title}', vars),
    })
  }
  if (vars.venue?.trim()) {
    rows.push({ label: 'Venue', value: vars.venue.trim() })
  }
  if (vars.venue_address?.trim()) {
    const mapUrl = vars.venue_map_url?.trim()
    rows.push({
      label: 'Lokasi acara',
      value: vars.venue_address.trim(),
      ...(mapUrl ? { href: mapUrl } : {}),
    })
  }
  if (vars.start_at_formatted?.trim()) {
    rows.push({ label: 'Waktu acara', value: vars.start_at_formatted.trim() })
  }

  if (rows.length === 0) return null

  return { meta: rows, detail: [], footer: [] }
}

export function renderEventScheduleBlock(vars: Record<string, string>): ReactNode | null {
  const parts = buildEventScheduleParts(vars)
  if (!parts) return null

  return renderTransactionSummaryCard(parts, 'default', { title: EVENT_SUMMARY_CARD_TITLE })
}

export function eventSchedulePartsToPlainLines(vars: Record<string, string>): string[] {
  const parts = buildEventScheduleParts(vars)
  if (!parts) return []
  return summaryPartsToPlainLines(parts)
}
