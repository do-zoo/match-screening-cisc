-- CreateEnum
CREATE TYPE "MemberAccessMode" AS ENUM ('open', 'tangsel_only', 'cisc_members');

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "memberAccessMode" "MemberAccessMode" NOT NULL DEFAULT 'open';
