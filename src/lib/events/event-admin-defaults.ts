import type { PrismaClient } from "@prisma/client";

function parseIdr(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === "") return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return n;
}

export const COMMITTEE_TICKET_FALLBACK_MEMBER_IDR = 125_000;
export const COMMITTEE_TICKET_FALLBACK_NON_MEMBER_IDR = 175_000;

/** Prisma `@id`; upsert/find use this literal. */
export const COMMITTEE_TICKET_DEFAULTS_KEY = "default" as const;

export type CommitteeTicketDefaultPrices = {
  ticketMemberPrice: number;
  ticketNonMemberPrice: number;
};

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
 * Spesifikasi produk: baris DB menang penuh bila tidak null; jika belum ada baris, gunakan env+fallback.
 */
export function pickCommitteeTicketDefaults(
  row: CommitteeTicketDefaultPrices | null,
): CommitteeTicketDefaultPrices {
  if (row != null) return row;
  return getCommitteeTicketDefaultsFromEnvOnly();
}

export async function resolveCommitteeTicketDefaults(
  db: Pick<PrismaClient, "committeeTicketDefaults">,
): Promise<CommitteeTicketDefaultPrices> {
  const row = await db.committeeTicketDefaults.findUnique({
    where: { singletonKey: COMMITTEE_TICKET_DEFAULTS_KEY },
    select: { ticketMemberPrice: true, ticketNonMemberPrice: true },
  });
  return pickCommitteeTicketDefaults(row);
}
