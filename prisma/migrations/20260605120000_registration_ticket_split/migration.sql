-- Split ticket pricing/menu from RegistrationHolder into RegistrationTicket.
-- Consolidate primary-only clone holder rows into one holder + N tickets.

CREATE TYPE "HolderDataMode" AS ENUM ('all_holders', 'primary_only');

ALTER TABLE "Registration" ADD COLUMN "holderDataMode" "HolderDataMode";

UPDATE "Registration" r
SET "holderDataMode" = CASE
  WHEN e."requireAllHolderData" THEN 'all_holders'::"HolderDataMode"
  ELSE 'primary_only'::"HolderDataMode"
END
FROM "Event" e
WHERE e."id" = r."eventId";

ALTER TABLE "Registration" ALTER COLUMN "holderDataMode" SET NOT NULL;
ALTER TABLE "Registration" ALTER COLUMN "holderDataMode" SET DEFAULT 'all_holders';

CREATE TABLE "RegistrationTicket" (
  "id" TEXT NOT NULL,
  "registrationId" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL,
  "ticketPriceApplied" INTEGER NOT NULL,
  "mandatoryMenuItemId" TEXT,
  "mandatoryMenuPriceApplied" INTEGER,
  "assignedHolderId" TEXT NOT NULL,

  CONSTRAINT "RegistrationTicket_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RegistrationTicket_registrationId_sortOrder_key" ON "RegistrationTicket"("registrationId", "sortOrder");
CREATE INDEX "RegistrationTicket_registrationId_idx" ON "RegistrationTicket"("registrationId");
CREATE INDEX "RegistrationTicket_assignedHolderId_idx" ON "RegistrationTicket"("assignedHolderId");

ALTER TABLE "RegistrationTicket" ADD CONSTRAINT "RegistrationTicket_registrationId_fkey"
  FOREIGN KEY ("registrationId") REFERENCES "Registration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RegistrationTicket" ADD CONSTRAINT "RegistrationTicket_mandatoryMenuItemId_fkey"
  FOREIGN KEY ("mandatoryMenuItemId") REFERENCES "VenueMenuItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RegistrationTicket" ADD CONSTRAINT "RegistrationTicket_assignedHolderId_fkey"
  FOREIGN KEY ("assignedHolderId") REFERENCES "RegistrationHolder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "RegistrationTicket" (
  "id",
  "registrationId",
  "sortOrder",
  "ticketPriceApplied",
  "mandatoryMenuItemId",
  "mandatoryMenuPriceApplied",
  "assignedHolderId"
)
SELECT
  'tkt_' || h."id",
  h."registrationId",
  h."sortOrder",
  h."ticketPriceApplied",
  h."mandatoryMenuItemId",
  h."mandatoryMenuPriceApplied",
  h."id"
FROM "RegistrationHolder" h;

-- Primary-only: satu holder (sortOrder=1), semua tiket mengacu ke holder tersebut.
UPDATE "RegistrationTicket" t
SET "assignedHolderId" = primary_h."id"
FROM "Registration" r
JOIN "RegistrationHolder" primary_h
  ON primary_h."registrationId" = r."id" AND primary_h."sortOrder" = 1
WHERE t."registrationId" = r."id"
  AND r."holderDataMode" = 'primary_only'
  AND (
    SELECT COUNT(*)::int FROM "RegistrationHolder" h WHERE h."registrationId" = r."id"
  ) > 1;

DELETE FROM "RegistrationHolder" h
USING "Registration" r
WHERE h."registrationId" = r."id"
  AND r."holderDataMode" = 'primary_only'
  AND h."sortOrder" > 1
  AND (
    SELECT COUNT(*)::int FROM "RegistrationHolder" h2 WHERE h2."registrationId" = r."id"
  ) > 1;

ALTER TABLE "RegistrationHolder" DROP CONSTRAINT IF EXISTS "RegistrationHolder_mandatoryMenuItemId_fkey";
ALTER TABLE "RegistrationHolder" DROP COLUMN "ticketPriceApplied";
ALTER TABLE "RegistrationHolder" DROP COLUMN "mandatoryMenuItemId";
ALTER TABLE "RegistrationHolder" DROP COLUMN "mandatoryMenuPriceApplied";
