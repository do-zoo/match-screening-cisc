import { describe, expect, it } from "vitest";

import {
  canMutatePicBankForTarget,
  viewerMayUseOwnerOnlyCommitteeControls,
} from "@/lib/admin/pic-bank-account-permissions";

describe("pic-bank-account-permissions", () => {
  const self = "profile-self";
  const other = "profile-other";

  it("blocks Viewer mutating anybody", () => {
    expect(canMutatePicBankForTarget("Viewer", self, self)).toBe(false);
  });

  it("allows Owner to mutate anybody", () => {
    expect(canMutatePicBankForTarget("Owner", self, other)).toBe(true);
  });

  it("allows Admin to mutate anybody", () => {
    expect(canMutatePicBankForTarget("Admin", self, other)).toBe(true);
  });

  it("Verifier may mutate only own profile-owned banks", () => {
    expect(canMutatePicBankForTarget("Verifier", self, self)).toBe(true);
    expect(canMutatePicBankForTarget("Verifier", self, other)).toBe(false);
  });

  it("viewerMayUseOwnerOnlyCommitteeControls Owner only", () => {
    expect(viewerMayUseOwnerOnlyCommitteeControls("Owner")).toBe(true);
    expect(viewerMayUseOwnerOnlyCommitteeControls("Admin")).toBe(false);
  });
});
