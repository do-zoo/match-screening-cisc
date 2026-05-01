-- Event: public-facing content, registration window controls, composite index.

DROP INDEX IF EXISTS "Event_status_idx";

ALTER TABLE "Event" ADD COLUMN "summary" TEXT,
ADD COLUMN "description" TEXT,
ADD COLUMN "endAt" TIMESTAMP(3),
ADD COLUMN "coverBlobUrl" TEXT,
ADD COLUMN "coverBlobPath" TEXT,
ADD COLUMN "registrationManualClosed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "registrationCapacity" INTEGER;

-- Existing rows must be backfilled before NOT NULL constraints.
UPDATE "Event" SET
  "summary" = LEFT(CONCAT(COALESCE("title", 'Acara'), ' — ringkasan singkat; perbarui dari admin.'), 500),
  "description" = '<p>Deskripsi acara (WYSIWYG/HTML). Sarankan memakai sanitiser saat konten dikelola dari admin.</p>',
  "endAt" = "startAt",
  "coverBlobUrl" = 'https://placehold.co/1200x630/001489/ffffff/png?text=Cover',
  "coverBlobPath" = '__migrations__/placeholder/event-cover.webp';

ALTER TABLE "Event" ALTER COLUMN "summary" SET NOT NULL,
ALTER COLUMN "description" SET NOT NULL,
ALTER COLUMN "endAt" SET NOT NULL,
ALTER COLUMN "coverBlobUrl" SET NOT NULL,
ALTER COLUMN "coverBlobPath" SET NOT NULL;

CREATE INDEX "Event_status_startAt_idx" ON "Event"("status", "startAt");

ALTER TABLE "Event" ADD CONSTRAINT "Event_end_at_gte_start_at" CHECK ("endAt" >= "startAt");
