import { formatWaIdr } from '@/lib/wa-templates/format-wa-idr'

/** Satu baris rincian tiket/menu untuk tabel ringkasan email (diserialisasi ke `transaction_line_items_json`). */
export type EmailTransactionLineItem = {
  /** Legacy / plain-text fallback */
  label: string
  value: string
  note?: string
  sortOrder?: number
  holderName?: string
  menuName?: string | null
}

export const TRANSACTION_LINE_ITEMS_JSON_KEY = 'transaction_line_items_json'

export type RegistrationTicketForEmailLineItem = {
  sortOrder: number
  ticketPriceApplied: number
  assignedHolder: { holderName: string }
  mandatoryMenuItem: { name: string } | null
}

export function buildTicketLineItems(
  tickets: RegistrationTicketForEmailLineItem[],
): EmailTransactionLineItem[] {
  return tickets.map(t => {
    const holderName = t.assignedHolder.holderName.trim()
    const menuName = t.mandatoryMenuItem?.name?.trim() ?? null
    const value = formatWaIdr(t.ticketPriceApplied)
    const label = `Tiket #${t.sortOrder} · ${holderName}`
    const note = menuName ? `Menu: ${menuName}` : undefined
    return {
      sortOrder: t.sortOrder,
      holderName,
      menuName,
      label,
      value,
      note,
    }
  })
}

export function serializeTransactionLineItems(items: EmailTransactionLineItem[]): string {
  return JSON.stringify(items)
}

export function parseTransactionLineItems(raw: string | undefined): EmailTransactionLineItem[] {
  if (!raw?.trim()) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap(row => {
      if (!row || typeof row !== 'object') return []
      const label = 'label' in row && typeof row.label === 'string' ? row.label.trim() : ''
      const value = 'value' in row && typeof row.value === 'string' ? row.value.trim() : ''
      if (!label || !value) return []
      const note =
        'note' in row && typeof row.note === 'string' && row.note.trim() ? row.note.trim() : undefined
      const sortOrder =
        'sortOrder' in row && typeof row.sortOrder === 'number' ? row.sortOrder : undefined
      const holderName =
        'holderName' in row && typeof row.holderName === 'string' ? row.holderName.trim() : undefined
      const menuName =
        'menuName' in row && typeof row.menuName === 'string'
          ? row.menuName.trim() || null
          : 'menuName' in row && row.menuName === null
            ? null
            : undefined
      return [{ label, value, note, sortOrder, holderName, menuName }]
    })
  } catch {
    return []
  }
}

export const SAMPLE_TRANSACTION_LINE_ITEMS: EmailTransactionLineItem[] = [
  {
    sortOrder: 1,
    holderName: 'Budi Santoso',
    menuName: 'Paket dinner',
    label: 'Tiket #1 · Budi Santoso',
    value: 'Rp425.000',
    note: 'Menu: Paket dinner',
  },
  {
    sortOrder: 2,
    holderName: 'Siti Rahayu',
    menuName: 'Paket dinner',
    label: 'Tiket #2 · Siti Rahayu',
    value: 'Rp425.000',
    note: 'Menu: Paket dinner',
  },
]

export function sampleTransactionLineItemsJson(): string {
  return serializeTransactionLineItems(SAMPLE_TRANSACTION_LINE_ITEMS)
}

export function withTransactionLineItems(
  vars: Record<string, string>,
  items: EmailTransactionLineItem[],
): Record<string, string> {
  if (items.length === 0) return vars
  return { ...vars, [TRANSACTION_LINE_ITEMS_JSON_KEY]: serializeTransactionLineItems(items) }
}
