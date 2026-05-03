import { prisma } from "@/lib/db/prisma";
import { buildRoleTree, flattenTreeDepthFirst } from "@/lib/management/build-role-tree";

export type PeriodTreeAssignee = {
  assignmentId: string;
  memberId: string;
  fullName: string;
  publicCode: string;
  masterMemberId: string | null;
};

export type PeriodTreeRow = {
  roleId: string;
  roleTitle: string;
  roleIsUnique: boolean;
  parentRoleId: string | null;
  depth: number;
  assignees: PeriodTreeAssignee[];
};

export async function listPeriodRolesAsTree(
  boardPeriodId: string,
): Promise<PeriodTreeRow[]> {
  const [roles, assignments] = await Promise.all([
    prisma.boardRole.findMany({
      select: {
        id: true,
        title: true,
        sortOrder: true,
        isUnique: true,
        isActive: true,
        parentRoleId: true,
      },
    }),
    prisma.boardAssignment.findMany({
      where: { boardPeriodId },
      select: {
        id: true,
        boardRoleId: true,
        managementMember: {
          select: {
            id: true,
            fullName: true,
            publicCode: true,
            masterMemberId: true,
          },
        },
      },
    }),
  ]);

  const assigneesByRole = new Map<string, PeriodTreeAssignee[]>();
  for (const a of assignments) {
    const list = assigneesByRole.get(a.boardRoleId) ?? [];
    list.push({
      assignmentId: a.id,
      memberId: a.managementMember.id,
      fullName: a.managementMember.fullName,
      publicCode: a.managementMember.publicCode,
      masterMemberId: a.managementMember.masterMemberId,
    });
    assigneesByRole.set(a.boardRoleId, list);
  }

  const tree = buildRoleTree(roles);
  const flat = flattenTreeDepthFirst(tree);

  return flat.map(({ node, depth }) => ({
    roleId: node.id,
    roleTitle: node.title,
    roleIsUnique: node.isUnique,
    parentRoleId: node.parentRoleId,
    depth,
    assignees: assigneesByRole.get(node.id) ?? [],
  }));
}
