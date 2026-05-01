import type { TicketPriceType, TicketRole } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  aggregateCrossRegistrationConflicts,
  formatTicketPriceTypeLabel,
  partnerSummaryFromTickets,
  resolvePrimaryMemberNumberForDirectoryLookup,
} from "./admin-ticket-context";

describe("resolvePrimaryMemberNumberForDirectoryLookup", () => {
  it("uses primary ticket memberNumber when set", () => {
    const n = resolvePrimaryMemberNumberForDirectoryLookup(
      [
        { role: "primary" as TicketRole, memberNumber: "M-01" },
        { role: "partner" as TicketRole, memberNumber: "M-02" },
      ],
      "M-99",
    );
    expect(n).toBe("M-01");
  });

  it("falls back to claimedMemberNumber when primary ticket has no number", () => {
    const n = resolvePrimaryMemberNumberForDirectoryLookup(
      [{ role: "primary" as TicketRole, memberNumber: null }],
      "M-99",
    );
    expect(n).toBe("M-99");
  });

  it("trims whitespace", () => {
    const n = resolvePrimaryMemberNumberForDirectoryLookup(
      [{ role: "primary" as TicketRole, memberNumber: "  X  " }],
      null,
    );
    expect(n).toBe("X");
  });

  it("returns null when nothing usable", () => {
    expect(
      resolvePrimaryMemberNumberForDirectoryLookup(
        [{ role: "primary" as TicketRole, memberNumber: null }],
        null,
      ),
    ).toBeNull();
  });
});

describe("partnerSummaryFromTickets", () => {
  it("returns null when no partner ticket", () => {
    expect(
      partnerSummaryFromTickets([
        {
          role: "primary" as TicketRole,
          fullName: "A",
          whatsapp: null,
          memberNumber: "1",
          ticketPriceType: "member" as TicketPriceType,
        },
      ]),
    ).toBeNull();
  });

  it("returns summary for partner row", () => {
    const s = partnerSummaryFromTickets([
      {
        role: "primary" as TicketRole,
        fullName: "A",
        whatsapp: null,
        memberNumber: "1",
        ticketPriceType: "member" as TicketPriceType,
      },
      {
        role: "partner" as TicketRole,
        fullName: "B",
        whatsapp: "6281",
        memberNumber: "2",
        ticketPriceType: "privilege_partner_member_price" as TicketPriceType,
      },
    ]);
    expect(s).toEqual({
      fullName: "B",
      whatsapp: "6281",
      memberNumber: "2",
      ticketPriceType: "privilege_partner_member_price",
      ticketPriceTypeLabel: formatTicketPriceTypeLabel(
        "privilege_partner_member_price",
      ),
    });
  });
});

describe("formatTicketPriceTypeLabel", () => {
  it.each([
    ["member" as TicketPriceType, "Member"],
    ["non_member" as TicketPriceType, "Non-member"],
    [
      "privilege_partner_member_price" as TicketPriceType,
      "Harga istimewa (tiket partner)",
    ],
  ])("maps %s", (t, label) => {
    expect(formatTicketPriceTypeLabel(t)).toBe(label);
  });
});

describe("aggregateCrossRegistrationConflicts", () => {
  it("returns empty for empty input", () => {
    expect(aggregateCrossRegistrationConflicts([])).toEqual([]);
  });

  it("dedupes by registrationId and merges member numbers", () => {
    const out = aggregateCrossRegistrationConflicts([
      { registrationId: "r1", contactName: "Az", memberNumber: "100" },
      { registrationId: "r1", contactName: "Az", memberNumber: "100" },
      { registrationId: "r1", contactName: "Az", memberNumber: "200" },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      registrationId: "r1",
      contactName: "Az",
      memberNumbers: ["100", "200"],
    });
  });

  it("sorts memberNumbers and sorts rows by contactName (id locale)", () => {
    const out = aggregateCrossRegistrationConflicts([
      { registrationId: "b", contactName: "Budi", memberNumber: "2" },
      { registrationId: "a", contactName: "Andi", memberNumber: "1" },
    ]);
    expect(out.map((x) => x.registrationId)).toEqual(["a", "b"]);
  });
});
