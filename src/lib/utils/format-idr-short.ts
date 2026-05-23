/**
 * Formats an IDR integer amount using abbreviated units.
 * Millions: up to 1 decimal place (e.g. Rp 1,5jt). Thousands: whole number (e.g. Rp 150K).
 */
export function formatIdrShort(amount: number): string {
  if (amount >= 1_000_000) {
    const juta = amount / 1_000_000
    const formatted = new Intl.NumberFormat('id-ID', {
      maximumFractionDigits: 1,
      minimumFractionDigits: 0,
    }).format(juta)
    return `Rp ${formatted}jt`
  }
  if (amount >= 1_000) {
    const ribu = Math.round(amount / 1_000)
    return `Rp ${ribu}K`
  }
  return `Rp ${amount}`
}
