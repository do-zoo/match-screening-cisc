-- Hapus opsi global_default: semua acara memakai harga per-acara (overridden).
UPDATE "Event" SET "pricingSource" = 'overridden' WHERE "pricingSource" = 'global_default';

CREATE TYPE "PricingSource_new" AS ENUM ('overridden');

ALTER TABLE "Event" ALTER COLUMN "pricingSource" DROP DEFAULT;

ALTER TABLE "Event"
  ALTER COLUMN "pricingSource" TYPE "PricingSource_new"
  USING ('overridden'::"PricingSource_new");

ALTER TABLE "Event"
  ALTER COLUMN "pricingSource" SET DEFAULT 'overridden'::"PricingSource_new";

DROP TYPE "PricingSource";

ALTER TYPE "PricingSource_new" RENAME TO "PricingSource";
