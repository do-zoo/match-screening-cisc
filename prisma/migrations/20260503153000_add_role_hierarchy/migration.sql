-- Add isUnique to BoardRole (default true for existing rows)
ALTER TABLE "BoardRole" ADD COLUMN "isUnique" BOOLEAN NOT NULL DEFAULT true;

-- Add parentRoleId self-reference (nullable)
ALTER TABLE "BoardRole" ADD COLUMN "parentRoleId" TEXT;
ALTER TABLE "BoardRole" ADD CONSTRAINT "BoardRole_parentRoleId_fkey"
  FOREIGN KEY ("parentRoleId") REFERENCES "BoardRole"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "BoardRole_parentRoleId_idx" ON "BoardRole"("parentRoleId");

-- Drop the two unique constraints on BoardAssignment
DROP INDEX IF EXISTS "BoardAssignment_boardPeriodId_managementMemberId_key";
DROP INDEX IF EXISTS "BoardAssignment_boardPeriodId_boardRoleId_key";

-- Add plain indexes (if not already present with these names)
CREATE INDEX IF NOT EXISTS "BoardAssignment_boardPeriodId_managementMemberId_idx"
  ON "BoardAssignment"("boardPeriodId", "managementMemberId");
CREATE INDEX IF NOT EXISTS "BoardAssignment_boardPeriodId_boardRoleId_idx"
  ON "BoardAssignment"("boardPeriodId", "boardRoleId");
