import type { AdminRole } from "@prisma/client";

export function roleChangePreservesAtLeastOneOwner(args: {
  ownerAuthUserIds: readonly string[];
  targetAuthUserId: string;
  previousRole: AdminRole;
  nextRole: AdminRole;
}): boolean {
  if (args.previousRole !== "Owner" || args.nextRole === "Owner") {
    return true;
  }
  const stillOwner = args.ownerAuthUserIds.filter(
    (id) => id !== args.targetAuthUserId,
  );
  return stillOwner.length > 0;
}
