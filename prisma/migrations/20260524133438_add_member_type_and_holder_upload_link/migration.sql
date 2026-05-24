-- CreateEnum
CREATE TYPE "MemberType" AS ENUM ('tangsel', 'regional');

-- AlterTable
ALTER TABLE "RegistrationHolder" ADD COLUMN     "memberType" "MemberType";

-- AlterTable
ALTER TABLE "Upload" ADD COLUMN     "registrationHolderId" TEXT;

-- CreateIndex
CREATE INDEX "Upload_registrationHolderId_idx" ON "Upload"("registrationHolderId");

-- AddForeignKey
ALTER TABLE "Upload" ADD CONSTRAINT "Upload_registrationHolderId_fkey" FOREIGN KEY ("registrationHolderId") REFERENCES "RegistrationHolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
