import { describe, expect, it, vi } from "vitest";

import type { LookupManagementCodeResult } from "@/lib/actions/lookup-management-code-for-registration";
import type { MemberPartnerLookupResult } from "@/lib/actions/lookup-member-partner-eligibility";

import {
  resolvePrimaryPurchaserIdentity,
  type PrimaryPurchaserIdentityDeps,
} from "./resolve-primary-purchaser-identity";

function memberFound(
  overrides: Partial<Extract<MemberPartnerLookupResult, { kind: "ok"; found: true }>> = {},
): MemberPartnerLookupResult {
  return {
    kind: "ok",
    found: true,
    canonicalMemberNumber: "CISC-1",
    fullName: "Budi",
    whatsapp: "08123456789",
    isManagementMember: false,
    ...overrides,
  };
}

function memberNotFound(): MemberPartnerLookupResult {
  return { kind: "ok", found: false, isManagementMember: false };
}

function managementOk(
  overrides: Partial<Extract<LookupManagementCodeResult, { kind: "ok" }>> = {},
): LookupManagementCodeResult {
  return {
    kind: "ok",
    fullName: "Ani",
    managementMemberId: "mm-1",
    ...overrides,
  };
}

describe("resolvePrimaryPurchaserIdentity", () => {
  it("returns empty for whitespace-only input", async () => {
    const deps: PrimaryPurchaserIdentityDeps = {
      lookupMember: vi.fn(),
      lookupManagement: vi.fn(),
    };
    const r = await resolvePrimaryPurchaserIdentity("  \t ", deps);
    expect(r.branch).toBe("empty");
    expect(deps.lookupMember).not.toHaveBeenCalled();
    expect(deps.lookupManagement).not.toHaveBeenCalled();
  });

  it("returns member and does not call management when directory matches", async () => {
    const deps: PrimaryPurchaserIdentityDeps = {
      lookupMember: vi.fn().mockResolvedValue(memberFound()),
      lookupManagement: vi.fn(),
    };
    const r = await resolvePrimaryPurchaserIdentity(" cisc-1 ", deps);
    expect(r.branch).toBe("member");
    if (r.branch !== "member") throw new Error("expected member");
    expect(r.canonicalMemberNumber).toBe("CISC-1");
    expect(deps.lookupManagement).not.toHaveBeenCalled();
  });

  it("returns management when member not found and code resolves", async () => {
    const deps: PrimaryPurchaserIdentityDeps = {
      lookupMember: vi.fn().mockResolvedValue(memberNotFound()),
      lookupManagement: vi.fn().mockResolvedValue(managementOk()),
    };
    const r = await resolvePrimaryPurchaserIdentity("reg-a", deps);
    expect(r.branch).toBe("management");
    if (r.branch !== "management") throw new Error("expected management");
    expect(r.normalizedCode).toBe("REG-A");
    expect(deps.lookupMember).toHaveBeenCalledWith("reg-a");
    expect(deps.lookupManagement).toHaveBeenCalledWith("reg-a");
  });

  it("returns neither when member not found and management fails", async () => {
    const deps: PrimaryPurchaserIdentityDeps = {
      lookupMember: vi.fn().mockResolvedValue(memberNotFound()),
      lookupManagement: vi.fn().mockResolvedValue({ kind: "not_found" }),
    };
    const r = await resolvePrimaryPurchaserIdentity("zzz", deps);
    expect(r.branch).toBe("neither");
    if (r.branch !== "neither") throw new Error("expected neither");
    expect(r.inputTrim).toBe("zzz");
  });
});
