-- If an older migration added "mapsUrl", rename to singular "mapUrl".
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Venue'
      AND column_name = 'mapsUrl'
  ) THEN
    ALTER TABLE "Venue" RENAME COLUMN "mapsUrl" TO "mapUrl";
  END IF;
END $$;
