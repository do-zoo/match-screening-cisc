/**
 * Acuan nominal bukti penutupan acara vs laporan keuangan (`getEventReport` → `finance`).
 * Ubah rumus di sini saja agar server action dan UI konsisten.
 */

export const SETTLEMENT_AMOUNT_TOLERANCE_IDR = 50_000;

/** Potongan angka laporan yang dipakai untuk menghitung acuan settlement. */
export type SettlementFinanceSnapshot = {
  ticketRevenueApproved: number;
  menuVenuePayoutApproved: number;
  adjustmentsPaidTotal: number;
};

/**
 * - `venueMenuPayout`: sama dengan agregat harga menu wajib approved (dana ke venue).
 * - `treasurerMargin`: tiket approved + penyesuaian yang sudah lunas (v1 — masuk bendahara komite).
 */
export function getSettlementExpectedAmounts(f: SettlementFinanceSnapshot): {
  venueMenuPayout: number;
  treasurerMargin: number;
} {
  return {
    venueMenuPayout: f.menuVenuePayoutApproved,
    treasurerMargin: f.ticketRevenueApproved + f.adjustmentsPaidTotal,
  };
}

export function settlementAmountMismatch(
  declared: number,
  expected: number,
): { delta: number; withinTolerance: boolean } {
  const delta = declared - expected;
  return {
    delta,
    withinTolerance: Math.abs(delta) <= SETTLEMENT_AMOUNT_TOLERANCE_IDR,
  };
}
