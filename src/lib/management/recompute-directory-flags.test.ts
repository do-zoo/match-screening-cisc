import { describe, expect, it } from "vitest";

import {
  findActiveBoardPeriod,
  type BoardPeriodRow,
} from "@/lib/management/active-period";
import {
  computeIsManagementMemberForMember,
  type BoardAssignmentRow,
} from "@/lib/management/recompute-directory-flags";

describe("findActiveBoardPeriod", () => {
  const periods: BoardPeriodRow[] = [
    {
      id: "p1",
      startsAt: new Date("2025-01-01T00:00:00.000Z"),
      endsAt: new Date("2025-12-31T00:00:00.000Z"),
    },
    {
      id: "p2",
      startsAt: new Date("2026-01-01T00:00:00.000Z"),
      endsAt: new Date("2026-12-31T00:00:00.000Z"),
    },
  ];

  it("returns period where startsAt <= now < endsAt", () => {
    const now = new Date("2026-06-15T12:00:00.000Z");
    expect(findActiveBoardPeriod(periods, now)?.id).toBe("p2");
  });

  it("returns null when none match", () => {
    const now = new Date("2027-06-15T12:00:00.000Z");
    expect(findActiveBoardPeriod(periods, now)).toBeNull();
  });
});

describe("computeIsManagementMemberForMember", () => {
  const activeId = "active";

  it("true when member linked and assigned in active period", () => {
    const assignments: BoardAssignmentRow[] = [
      {
        boardPeriodId: activeId,
        managementMemberId: "mm1",
        masterMemberId: "m1",
      },
    ];
    expect(
      computeIsManagementMemberForMember({
        masterMemberId: "m1",
        activePeriodId: activeId,
        assignments,
      }),
    ).toBe(true);
  });

  it("false when period inactive", () => {
    const assignments: BoardAssignmentRow[] = [
      {
        boardPeriodId: "other",
        managementMemberId: "mm1",
        masterMemberId: "m1",
      },
    ];
    expect(
      computeIsManagementMemberForMember({
        masterMemberId: "m1",
        activePeriodId: null,
        assignments,
      }),
    ).toBe(false);
  });
});
