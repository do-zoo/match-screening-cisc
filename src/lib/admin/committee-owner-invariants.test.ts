import { describe, expect, it } from "vitest";

import { roleChangePreservesAtLeastOneOwner } from "@/lib/admin/committee-owner-invariants";

describe("roleChangePreservesAtLeastOneOwner", () => {
  it("allows demoting Owner when another Owner exists", () => {
    const owners = ["o1", "o2"];
    expect(
      roleChangePreservesAtLeastOneOwner({
        ownerAuthUserIds: owners,
        targetAuthUserId: "o1",
        previousRole: "Owner",
        nextRole: "Admin",
      }),
    ).toBe(true);
  });

  it("blocks demoting the only Owner", () => {
    const owners = ["o1"];
    expect(
      roleChangePreservesAtLeastOneOwner({
        ownerAuthUserIds: owners,
        targetAuthUserId: "o1",
        previousRole: "Owner",
        nextRole: "Admin",
      }),
    ).toBe(false);
  });

  it("allows non-Owner changing role freely when single Owner elsewhere", () => {
    expect(
      roleChangePreservesAtLeastOneOwner({
        ownerAuthUserIds: ["alice"],
        targetAuthUserId: "bob",
        previousRole: "Admin",
        nextRole: "Viewer",
      }),
    ).toBe(true);
  });

  it("allows promoting to Owner regardless of counts", () => {
    expect(
      roleChangePreservesAtLeastOneOwner({
        ownerAuthUserIds: ["alice"],
        targetAuthUserId: "bob",
        previousRole: "Admin",
        nextRole: "Owner",
      }),
    ).toBe(true);
  });

  it("allows Owner staying Owner", () => {
    expect(
      roleChangePreservesAtLeastOneOwner({
        ownerAuthUserIds: ["o1"],
        targetAuthUserId: "o1",
        previousRole: "Owner",
        nextRole: "Owner",
      }),
    ).toBe(true);
  });
});
