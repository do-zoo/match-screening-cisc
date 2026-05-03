import { describe, expect, it } from "vitest";

import { buildRoleTree, flattenTreeDepthFirst } from "./build-role-tree";

const roles = [
  { id: "r1", title: "Ketua", sortOrder: 1, isUnique: true, isActive: true, parentRoleId: null },
  { id: "r2", title: "Sekretaris", sortOrder: 2, isUnique: true, isActive: true, parentRoleId: "r1" },
  { id: "r3", title: "Staf Sekretaris", sortOrder: 1, isUnique: false, isActive: true, parentRoleId: "r2" },
  { id: "r4", title: "Bendahara", sortOrder: 3, isUnique: true, isActive: true, parentRoleId: "r1" },
  { id: "r5", title: "Divisi X", sortOrder: 10, isUnique: false, isActive: true, parentRoleId: null },
];

describe("buildRoleTree", () => {
  it("returns root nodes (no parent)", () => {
    const tree = buildRoleTree(roles);
    expect(tree.map((n) => n.id)).toEqual(["r1", "r5"]);
  });

  it("attaches children to parent sorted by sortOrder", () => {
    const tree = buildRoleTree(roles);
    const ketua = tree.find((n) => n.id === "r1")!;
    expect(ketua.children.map((c) => c.id)).toEqual(["r2", "r4"]);
  });

  it("handles orphan parentRoleId gracefully — treats as root", () => {
    const withOrphan = [
      ...roles,
      { id: "r6", title: "Orphan", sortOrder: 99, isUnique: true, isActive: true, parentRoleId: "nonexistent" },
    ];
    const tree = buildRoleTree(withOrphan);
    expect(tree.map((n) => n.id)).toContain("r6");
  });
});

describe("flattenTreeDepthFirst", () => {
  it("returns nodes in depth-first order with correct depth", () => {
    const tree = buildRoleTree(roles);
    const flat = flattenTreeDepthFirst(tree);
    expect(flat.map((f) => f.node.id)).toEqual(["r1", "r2", "r3", "r4", "r5"]);
    expect(flat.map((f) => f.depth)).toEqual([0, 1, 2, 1, 0]);
  });
});
