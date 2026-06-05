-- AlterTable: structured contact fields; migrate legacy footer text to location
ALTER TABLE "ClubBranding" ADD COLUMN "contactEmail" TEXT;
ALTER TABLE "ClubBranding" ADD COLUMN "websiteUrl" TEXT;
ALTER TABLE "ClubBranding" ADD COLUMN "locationText" VARCHAR(200);
ALTER TABLE "ClubBranding" ADD COLUMN "socialLinks" JSONB;

UPDATE "ClubBranding"
SET "locationText" = "footerPlainText"
WHERE "footerPlainText" IS NOT NULL
  AND TRIM("footerPlainText") <> ''
  AND ("locationText" IS NULL OR TRIM("locationText") = '');

ALTER TABLE "ClubBranding" DROP COLUMN "footerPlainText";
