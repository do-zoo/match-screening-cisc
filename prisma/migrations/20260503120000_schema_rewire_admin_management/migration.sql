-- Step 1: Add managementMemberId to AdminProfile (nullable for data migration)
ALTER TABLE "AdminProfile" ADD COLUMN "managementMemberId" TEXT;
ALTER TABLE "AdminProfile" ADD CONSTRAINT "AdminProfile_managementMemberId_fkey"
  FOREIGN KEY ("managementMemberId") REFERENCES "ManagementMember"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
CREATE UNIQUE INDEX "AdminProfile_managementMemberId_key" ON "AdminProfile"("managementMemberId");
CREATE INDEX "AdminProfile_managementMemberId_idx" ON "AdminProfile"("managementMemberId");

-- Step 2: Data-migrate AdminProfile.memberId → managementMemberId
-- For each AdminProfile whose memberId links to a MasterMember that has a ManagementMember record,
-- set managementMemberId to that ManagementMember's id.
UPDATE "AdminProfile" ap
SET "managementMemberId" = mm.id
FROM "ManagementMember" mm
WHERE ap."memberId" = mm."masterMemberId"
  AND mm."masterMemberId" IS NOT NULL;

-- Step 3: Add adminProfileId to EventPicHelper (nullable for data migration)
ALTER TABLE "EventPicHelper" ADD COLUMN "adminProfileId" TEXT;
ALTER TABLE "EventPicHelper" ADD CONSTRAINT "EventPicHelper_adminProfileId_fkey"
  FOREIGN KEY ("adminProfileId") REFERENCES "AdminProfile"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 4: Data-migrate EventPicHelper.memberId → adminProfileId
-- Use AdminProfile.memberId BEFORE it is dropped.
UPDATE "EventPicHelper" eph
SET "adminProfileId" = ap.id
FROM "AdminProfile" ap
WHERE ap."memberId" = eph."memberId"
  AND ap."memberId" IS NOT NULL;

-- Step 5: Delete orphan EventPicHelper rows (no matching AdminProfile)
DELETE FROM "EventPicHelper" WHERE "adminProfileId" IS NULL;

-- Step 6: Make adminProfileId NOT NULL
ALTER TABLE "EventPicHelper" ALTER COLUMN "adminProfileId" SET NOT NULL;

-- Step 7: Drop old EventPicHelper primary key and add new one
ALTER TABLE "EventPicHelper" DROP CONSTRAINT "EventPicHelper_pkey";
ALTER TABLE "EventPicHelper" ADD PRIMARY KEY ("eventId", "adminProfileId");

-- Step 8: Add new index, drop old one
CREATE INDEX "EventPicHelper_adminProfileId_idx" ON "EventPicHelper"("adminProfileId");
DROP INDEX IF EXISTS "EventPicHelper_memberId_idx";

-- Step 9: Drop EventPicHelper.memberId column
ALTER TABLE "EventPicHelper" DROP COLUMN "memberId";

-- Step 10: Drop AdminProfile.memberId column and its index
DROP INDEX IF EXISTS "AdminProfile_memberId_idx";
ALTER TABLE "AdminProfile" DROP COLUMN "memberId";
