-- Harga tiket selalu per-acara; kolom pricingSource tidak lagi dipakai.
ALTER TABLE "Event" DROP COLUMN "pricingSource";

DROP TYPE "PricingSource";
