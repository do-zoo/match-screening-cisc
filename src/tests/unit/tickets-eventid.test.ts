import { describe, expect, test } from "vitest";
import { buildTicketCreateData } from "@/lib/db/tickets";

describe("db: buildTicketCreateData", () => {
  test("sets ticket.eventId from registration.eventId", () => {
    const data = buildTicketCreateData({
      registrationId: "r1",
      eventId: "e1",
      role: "primary",
      fullName: "A",
      whatsapp: "628123",
      memberNumber: "123",
      ticketPriceType: "member",
    });
    expect(data.eventId).toBe("e1");
    expect(data.registration).toEqual({ connect: { id: "r1" } });
  });
});
