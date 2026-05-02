export type BoardAssignmentRow = {
  boardPeriodId: string;
  managementMemberId: string;
  /** Denormalized from `ManagementMember.masterMemberId` for the same `managementMemberId`. */
  masterMemberId: string | null;
};

export function computeIsManagementMemberForMember(input: {
  masterMemberId: string;
  activePeriodId: string | null;
  assignments: BoardAssignmentRow[];
}): boolean {
  if (!input.activePeriodId) return false;
  return input.assignments.some(
    (r) =>
      r.boardPeriodId === input.activePeriodId &&
      r.masterMemberId === input.masterMemberId,
  );
}
