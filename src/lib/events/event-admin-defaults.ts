export const COMMITTEE_TICKET_FALLBACK_MEMBER_IDR = 125_000;
export const COMMITTEE_TICKET_FALLBACK_NON_MEMBER_IDR = 175_000;

/** @deprecated Baris DB komite dihapus; kunci ini hanya untuk kompatibilitas impor lama. */
export const COMMITTEE_TICKET_DEFAULTS_KEY = "default" as const;

export type CommitteeTicketDefaultPrices = {
  ticketMemberPrice: number;
  ticketNonMemberPrice: number;
};

function parseIdr(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === "") return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return n;
}

/** Nilai dari env `MATCH_DEFAULT_TICKET_*` lalu fallback numerik seed. */
export function getCommitteeTicketDefaultsFromEnvOnly(): CommitteeTicketDefaultPrices {
  return {
    ticketMemberPrice: parseIdr(
      process.env.MATCH_DEFAULT_TICKET_MEMBER_IDR,
      COMMITTEE_TICKET_FALLBACK_MEMBER_IDR,
    ),
    ticketNonMemberPrice: parseIdr(
      process.env.MATCH_DEFAULT_TICKET_NON_MEMBER_IDR,
      COMMITTEE_TICKET_FALLBACK_NON_MEMBER_IDR,
    ),
  };
}

/**
 * Spesifikasi produk: sumber harga saran untuk form admin hanya dari env+fallback
 * (tidak ada lagi tabel `CommitteeTicketDefaults`).
 */
export function pickCommitteeTicketDefaults(
  row: CommitteeTicketDefaultPrices | null,
): CommitteeTicketDefaultPrices {
  if (row != null) return row;
  return getCommitteeTicketDefaultsFromEnvOnly();
}

export async function resolveCommitteeTicketDefaults(): Promise<CommitteeTicketDefaultPrices> {
  return getCommitteeTicketDefaultsFromEnvOnly();
}
