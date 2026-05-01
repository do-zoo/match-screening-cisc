import { afterEach, describe, expect, it, vi } from "vitest";

import { getCommitteeTicketDefaults } from "@/lib/events/event-admin-defaults";

describe("getCommitteeTicketDefaults", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses seed-aligned fallbacks when env missing", () => {
    vi.stubEnv("MATCH_DEFAULT_TICKET_MEMBER_IDR", "");
    vi.stubEnv("MATCH_DEFAULT_TICKET_NON_MEMBER_IDR", "");
    expect(getCommitteeTicketDefaults()).toEqual({
      ticketMemberPrice: 125_000,
      ticketNonMemberPrice: 175_000,
    });
  });

  it("parses overrides", () => {
    vi.stubEnv("MATCH_DEFAULT_TICKET_MEMBER_IDR", "90000");
    vi.stubEnv("MATCH_DEFAULT_TICKET_NON_MEMBER_IDR", "99000");
    expect(getCommitteeTicketDefaults()).toEqual({
      ticketMemberPrice: 90_000,
      ticketNonMemberPrice: 99_000,
    });
  });
});
