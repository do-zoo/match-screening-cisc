import { describe, expect, it } from "vitest";

import { normalizeAdminInvitationEmail } from "./admin-invite-email";

describe("normalizeAdminInvitationEmail", () => {
  it("lowercases and trims", () => {
    expect(normalizeAdminInvitationEmail("  A@B.COM ")).toBe("a@b.com");
  });
});
