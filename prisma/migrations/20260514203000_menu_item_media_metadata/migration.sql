-- Add optional public-facing metadata for venue menu items.
ALTER TABLE "VenueMenuItem"
  ADD COLUMN "description" TEXT,
  ADD COLUMN "imageBlobUrl" TEXT,
  ADD COLUMN "imageBlobPath" TEXT;
