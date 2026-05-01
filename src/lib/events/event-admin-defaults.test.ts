import { afterEach, describe, expect, it, vi } from "vitest";

import {
  COMMITTEE_TICKET_FALLBACK_MEMBER_IDR,
  COMMITTEE_TICKET_FALLBACK_NON_MEMBER_IDR,
  getCommitteeTicketDefaultsFromEnvOnly,
  pickCommitteeTicketDefaults,
} from "@/lib/events/event-admin-defaults";

describe("getCommitteeTicketDefaultsFromEnvOnly", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses numeric fallbacks when env missing", () => {
    vi.stubEnv("MATCH_DEFAULT_TICKET_MEMBER_IDR", "");
    vi.stubEnv("MATCH_DEFAULT_TICKET_NON_MEMBER_IDR", "");
    expect(getCommitteeTicketDefaultsFromEnvOnly()).toEqual({
      ticketMemberPrice: COMMITTEE_TICKET_FALLBACK_MEMBER_IDR,
      ticketNonMemberPrice: COMMITTEE_TICKET_FALLBACK_NON_MEMBER_IDR,
    });
  });

  it("parses env overrides", () => {
    vi.stubEnv("MATCH_DEFAULT_TICKET_MEMBER_IDR", "90000");
    vi.stubEnv("MATCH_DEFAULT_TICKET_NON_MEMBER_IDR", "99000");
    expect(getCommitteeTicketDefaultsFromEnvOnly()).toEqual({
      ticketMemberPrice: 90_000,
      ticketNonMemberPrice: 99_000,
    });
  });
});

describe("pickCommitteeTicketDefaults", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("prefers DB row when present", () => {
    expect(
      pickCommitteeTicketDefaults({
        ticketMemberPrice: 1,
        ticketNonMemberPrice: 2,
      }),
    ).toEqual({ ticketMemberPrice: 1, ticketNonMemberPrice: 2 });
  });

  it("falls back to env ladder when row null", () => {
    vi.stubEnv("MATCH_DEFAULT_TICKET_MEMBER_IDR", "80000");
    vi.stubEnv("MATCH_DEFAULT_TICKET_NON_MEMBER_IDR", "");
    expect(pickCommitteeTicketDefaults(null)).toEqual({
      ticketMemberPrice: 80_000,
      ticketNonMemberPrice: COMMITTEE_TICKET_FALLBACK_NON_MEMBER_IDR,
    });
  });
});
