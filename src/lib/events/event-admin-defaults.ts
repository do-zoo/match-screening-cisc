function parseIdr(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === "") return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return n;
}

/** Global default ticket prices for *new events* until committee Settings UI persists DB row. */
export function getCommitteeTicketDefaults(): {
  ticketMemberPrice: number;
  ticketNonMemberPrice: number;
} {
  return {
    ticketMemberPrice: parseIdr(process.env.MATCH_DEFAULT_TICKET_MEMBER_IDR, 125_000),
    ticketNonMemberPrice: parseIdr(process.env.MATCH_DEFAULT_TICKET_NON_MEMBER_IDR, 175_000),
  };
}
