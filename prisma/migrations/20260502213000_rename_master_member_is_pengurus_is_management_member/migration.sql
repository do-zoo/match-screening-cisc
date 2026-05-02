-- Rename directory flag to English identifier (committee/board eligibility).
ALTER TABLE "MasterMember" RENAME COLUMN "isPengurus" TO "isManagementMember";
