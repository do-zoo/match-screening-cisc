-- AlterTable: structured contact fields; migrate legacy footer text to location
ALTER TABLE "ClubBranding" ADD COLUMN "contact_email" TEXT;
ALTER TABLE "ClubBranding" ADD COLUMN "website_url" TEXT;
ALTER TABLE "ClubBranding" ADD COLUMN "location_text" VARCHAR(200);
ALTER TABLE "ClubBranding" ADD COLUMN "social_links" JSONB;

UPDATE "ClubBranding"
SET "location_text" = "footer_plain_text"
WHERE "footer_plain_text" IS NOT NULL
  AND TRIM("footer_plain_text") <> ''
  AND ("location_text" IS NULL OR TRIM("location_text") = '');

ALTER TABLE "ClubBranding" DROP COLUMN "footer_plain_text";
