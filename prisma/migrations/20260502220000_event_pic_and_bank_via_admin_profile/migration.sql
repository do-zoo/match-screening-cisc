-- PIC acara & rekening PIC: milik AdminProfile, bukan MasterMember.
-- Backfill memakai AdminProfile.memberId yang cocok dengan PIC/rekening lama.

ALTER TABLE "PicBankAccount" ADD COLUMN "ownerAdminProfileId" TEXT;
ALTER TABLE "Event" ADD COLUMN "picAdminProfileId" TEXT;

UPDATE "PicBankAccount" AS p
SET "ownerAdminProfileId" = a."id"
FROM "AdminProfile" AS a
WHERE a."memberId" IS NOT NULL
  AND a."memberId" = p."ownerMemberId";

UPDATE "Event" AS e
SET "picAdminProfileId" = a."id"
FROM "AdminProfile" AS a
WHERE a."memberId" IS NOT NULL
  AND a."memberId" = e."picMasterMemberId";

ALTER TABLE "Event" DROP CONSTRAINT "Event_picMasterMemberId_fkey";
DROP INDEX IF EXISTS "Event_picMasterMemberId_idx";

ALTER TABLE "PicBankAccount" DROP CONSTRAINT "PicBankAccount_ownerMemberId_fkey";
DROP INDEX IF EXISTS "PicBankAccount_ownerMemberId_idx";

ALTER TABLE "Event" DROP COLUMN "picMasterMemberId";
ALTER TABLE "PicBankAccount" DROP COLUMN "ownerMemberId";

ALTER TABLE "PicBankAccount" ALTER COLUMN "ownerAdminProfileId" SET NOT NULL;
ALTER TABLE "Event" ALTER COLUMN "picAdminProfileId" SET NOT NULL;

ALTER TABLE "PicBankAccount" ADD CONSTRAINT "PicBankAccount_ownerAdminProfileId_fkey" FOREIGN KEY ("ownerAdminProfileId") REFERENCES "AdminProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "PicBankAccount_ownerAdminProfileId_idx" ON "PicBankAccount"("ownerAdminProfileId");

ALTER TABLE "Event" ADD CONSTRAINT "Event_picAdminProfileId_fkey" FOREIGN KEY ("picAdminProfileId") REFERENCES "AdminProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "Event_picAdminProfileId_idx" ON "Event"("picAdminProfileId");

ALTER TABLE "MasterMember" DROP COLUMN IF EXISTS "canBePIC";
