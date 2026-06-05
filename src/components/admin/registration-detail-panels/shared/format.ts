import type { UploadPurpose } from '@prisma/client'

export function formatCurrencyIdr(n: number): string {
  const formatted = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(n)
  const compact = formatted.replace(/\s+/g, '')
  return compact.startsWith('Rp') ? `Rp ${compact.slice(2)}` : compact
}

export function formatUploadPurpose(purpose: UploadPurpose): string {
  if (purpose === 'transfer_proof') return 'Bukti transfer'
  if (purpose === 'member_card_photo') return 'Foto kartu member'
  if (purpose === 'partner_member_card_photo') return 'Foto kartu member (partner)'
  return 'Bukti penyesuaian invoice'
}

export const registrationDetailDateFormatter = new Intl.DateTimeFormat('id-ID', {
  dateStyle: 'medium',
  timeStyle: 'short',
})
