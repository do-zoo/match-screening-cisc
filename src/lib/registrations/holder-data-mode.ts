import type { HolderDataMode } from '@prisma/client'

export function holderDataModeLabel(mode: HolderDataMode): string {
  if (mode === 'primary_only') return 'Pemesan utama untuk semua tiket'
  return 'Data per pemegang tiket'
}

export function registrantsSectionBadge(mode: HolderDataMode, holderCount: number, ticketQty: number): string {
  if (mode === 'primary_only' && ticketQty > 1) {
    return `${holderCount} pemesan · ${ticketQty} tiket`
  }
  if (holderCount === ticketQty) {
    return `${holderCount} pemegang`
  }
  return `${holderCount} orang · ${ticketQty} tiket`
}
