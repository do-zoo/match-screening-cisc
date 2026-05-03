export type RoleFlatNode = {
  id: string;
  title: string;
  sortOrder: number;
  isUnique: boolean;
  isActive: boolean;
  parentRoleId: string | null;
};

export type RoleTreeNode = RoleFlatNode & {
  children: RoleTreeNode[];
};

export function buildRoleTree(flat: RoleFlatNode[]): RoleTreeNode[] {
  const byId = new Map<string, RoleTreeNode>(
    flat.map((r) => [r.id, { ...r, children: [] }]),
  );

  const roots: RoleTreeNode[] = [];
  for (const node of byId.values()) {
    const parent = node.parentRoleId ? byId.get(node.parentRoleId) : null;
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortBy = (a: RoleTreeNode, b: RoleTreeNode) =>
    a.sortOrder - b.sortOrder || a.title.localeCompare(b.title, "id");

  function sort(nodes: RoleTreeNode[]): void {
    nodes.sort(sortBy);
    for (const n of nodes) sort(n.children);
  }
  sort(roots);

  return roots;
}

export function flattenTreeDepthFirst(
  nodes: RoleTreeNode[],
  depth = 0,
): Array<{ node: RoleTreeNode; depth: number }> {
  const result: Array<{ node: RoleTreeNode; depth: number }> = [];
  for (const node of nodes) {
    result.push({ node, depth });
    result.push(...flattenTreeDepthFirst(node.children, depth + 1));
  }
  return result;
}
