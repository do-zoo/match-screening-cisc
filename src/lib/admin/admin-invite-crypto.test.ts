import { describe, expect, it } from "vitest";

import { generateAdminInviteToken, hashAdminInviteToken } from "./admin-invite-crypto";

describe("hashAdminInviteToken", () => {
  it("is deterministic hex", () => {
    expect(hashAdminInviteToken("abc")).toBe(hashAdminInviteToken("abc"));
    expect(hashAdminInviteToken("abc")).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("generateAdminInviteToken", () => {
  it("returns raw + matching hash", () => {
    const a = generateAdminInviteToken();
    expect(a.rawToken.length).toBeGreaterThan(30);
    expect(hashAdminInviteToken(a.rawToken)).toBe(a.tokenHash);
  });

  it("generates differing tokens", () => {
    const a = generateAdminInviteToken();
    const b = generateAdminInviteToken();
    expect(a.rawToken).not.toBe(b.rawToken);
  });
});
