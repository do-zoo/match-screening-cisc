/**
 * Acuan nominal bukti penutupan acara vs laporan keuangan (`getEventReport` → `finance`).
 * Ubah rumus di sini saja agar server action dan UI konsisten.
 */

export const SETTLEMENT_AMOUNT_TOLERANCE_IDR = 50_000

/** Potongan angka laporan yang dipakai untuk menghitung acuan settlement. */
export type SettlementFinanceSnapshot = {
  /** Jumlah `computedTotalAtSubmit` pendaftaran approved (uang masuk snapshot). */
  baselineTotalApproved: number
  menuVenuePayoutApproved: number
  adjustmentsPaidTotal: number
}

/**
 * - `venueMenuPayout`: sama dengan agregat harga menu wajib approved (dana ke venue).
 * - `treasurerMargin`: baseline uang masuk − alokasi menu venue + penyesuaian lunas (benar untuk snapshot lama tiket+menu dan tiket inklusif).
 */
export function getSettlementExpectedAmounts(f: SettlementFinanceSnapshot): {
  venueMenuPayout: number
  treasurerMargin: number
} {
  return {
    venueMenuPayout: f.menuVenuePayoutApproved,
    treasurerMargin: f.baselineTotalApproved - f.menuVenuePayoutApproved + f.adjustmentsPaidTotal,
  }
}

export function settlementAmountMismatch(
  declared: number,
  expected: number,
): { delta: number; withinTolerance: boolean } {
  const delta = declared - expected
  return {
    delta,
    withinTolerance: Math.abs(delta) <= SETTLEMENT_AMOUNT_TOLERANCE_IDR,
  }
}
