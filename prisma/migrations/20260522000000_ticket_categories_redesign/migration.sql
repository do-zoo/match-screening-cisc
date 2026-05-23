-- Migration: ticket_categories_redesign
-- Replaces flat per-event pricing with EventTicketCategory,
-- and the partner-row pattern with RegistrationHolder.

-- ============================================================
-- 1. Create EventTicketCategory table
-- ============================================================
CREATE TABLE "EventTicketCategory" (
    "id"              TEXT NOT NULL,
    "eventId"         TEXT NOT NULL,
    "name"            TEXT NOT NULL,
    "regularPrice"    INTEGER NOT NULL,
    "memberPrice"     INTEGER NOT NULL,
    "maxQtyPerPerson" INTEGER,
    "sortOrder"       INTEGER NOT NULL DEFAULT 0,
    "isActive"        BOOLEAN NOT NULL DEFAULT true,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventTicketCategory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EventTicketCategory_eventId_sortOrder_idx" ON "EventTicketCategory"("eventId", "sortOrder");

ALTER TABLE "EventTicketCategory"
    ADD CONSTRAINT "EventTicketCategory_eventId_fkey"
    FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- 2. Seed one default category per event from existing pricing
-- ============================================================
-- We insert one "Tiket" category per event using the existing
-- ticketMemberPrice / ticketNonMemberPrice values.
INSERT INTO "EventTicketCategory" ("id", "eventId", "name", "regularPrice", "memberPrice", "sortOrder", "isActive", "createdAt")
SELECT
    'def_' || "id",
    "id",
    'Tiket',
    "ticketNonMemberPrice",
    "ticketMemberPrice",
    0,
    true,
    NOW()
FROM "Event";

-- ============================================================
-- 3. Add multiCategoryPurchase to Event
-- ============================================================
ALTER TABLE "Event" ADD COLUMN "multiCategoryPurchase" BOOLEAN NOT NULL DEFAULT false;

-- ============================================================
-- 4. Drop old pricing columns from Event
-- ============================================================
ALTER TABLE "Event" DROP COLUMN "ticketMemberPrice";
ALTER TABLE "Event" DROP COLUMN "ticketNonMemberPrice";

-- ============================================================
-- 5. Create RegistrationHolder table
-- ============================================================
CREATE TABLE "RegistrationHolder" (
    "id"                        TEXT NOT NULL,
    "registrationId"            TEXT NOT NULL,
    "sortOrder"                 INTEGER NOT NULL,
    "holderName"                TEXT NOT NULL,
    "claimedMemberNumber"       TEXT,
    "memberValidation"          "MemberValidation" NOT NULL DEFAULT 'unknown',
    "memberId"                  TEXT,
    "ticketPriceApplied"        INTEGER NOT NULL,
    "mandatoryMenuItemId"       TEXT,
    "mandatoryMenuPriceApplied" INTEGER,

    CONSTRAINT "RegistrationHolder_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RegistrationHolder_registrationId_idx" ON "RegistrationHolder"("registrationId");

ALTER TABLE "RegistrationHolder"
    ADD CONSTRAINT "RegistrationHolder_registrationId_fkey"
    FOREIGN KEY ("registrationId") REFERENCES "Registration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RegistrationHolder"
    ADD CONSTRAINT "RegistrationHolder_memberId_fkey"
    FOREIGN KEY ("memberId") REFERENCES "MasterMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RegistrationHolder"
    ADD CONSTRAINT "RegistrationHolder_mandatoryMenuItemId_fkey"
    FOREIGN KEY ("mandatoryMenuItemId") REFERENCES "VenueMenuItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================
-- 6. Add new columns to Registration (nullable first)
-- ============================================================
ALTER TABLE "Registration" ADD COLUMN "ticketCategoryId" TEXT;
ALTER TABLE "Registration" ADD COLUMN "ticketQty" INTEGER NOT NULL DEFAULT 1;

-- ============================================================
-- 7. Migrate existing registrations to the default category
-- ============================================================
-- Primary registrations: point to their event's default category
UPDATE "Registration" r
SET "ticketCategoryId" = 'def_' || r."eventId"
WHERE r."primaryRegistrationId" IS NULL;

-- Partner registrations: also point to their event's default category
UPDATE "Registration" r
SET "ticketCategoryId" = 'def_' || r."eventId"
WHERE r."primaryRegistrationId" IS NOT NULL;

-- Migrate existing Registration fields into RegistrationHolder rows
-- Primary tickets
INSERT INTO "RegistrationHolder" (
    "id", "registrationId", "sortOrder", "holderName",
    "claimedMemberNumber", "memberValidation", "memberId",
    "ticketPriceApplied", "mandatoryMenuItemId", "mandatoryMenuPriceApplied"
)
SELECT
    'h_' || r."id",
    r."id",
    0,
    r."contactName",
    r."claimedMemberNumber",
    r."memberValidation",
    r."memberId",
    r."ticketPriceApplied",
    r."mandatoryMenuItemId",
    r."mandatoryMenuPriceApplied"
FROM "Registration" r;

-- ============================================================
-- 8. Make ticketCategoryId NOT NULL now that rows are backfilled
-- ============================================================
ALTER TABLE "Registration" ALTER COLUMN "ticketCategoryId" SET NOT NULL;

-- ============================================================
-- 9. Add FK constraint for ticketCategoryId
-- ============================================================
ALTER TABLE "Registration"
    ADD CONSTRAINT "Registration_ticketCategoryId_fkey"
    FOREIGN KEY ("ticketCategoryId") REFERENCES "EventTicketCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================
-- 10. Drop old Registration columns
-- ============================================================
-- Drop FK constraints first
ALTER TABLE "Registration" DROP CONSTRAINT IF EXISTS "Registration_primaryRegistrationId_fkey";
ALTER TABLE "Registration" DROP CONSTRAINT IF EXISTS "Registration_mandatoryMenuItemId_fkey";
ALTER TABLE "Registration" DROP CONSTRAINT IF EXISTS "Registration_primaryManagementMemberId_fkey";

-- Drop the index on primaryRegistrationId
DROP INDEX IF EXISTS "Registration_primaryRegistrationId_idx";

ALTER TABLE "Registration" DROP COLUMN IF EXISTS "primaryRegistrationId";
ALTER TABLE "Registration" DROP COLUMN IF EXISTS "ticketRole";
ALTER TABLE "Registration" DROP COLUMN IF EXISTS "ticketPriceType";
ALTER TABLE "Registration" DROP COLUMN IF EXISTS "mandatoryMenuItemId";
ALTER TABLE "Registration" DROP COLUMN IF EXISTS "ticketPriceApplied";
ALTER TABLE "Registration" DROP COLUMN IF EXISTS "mandatoryMenuPriceApplied";
ALTER TABLE "Registration" DROP COLUMN IF EXISTS "primaryManagementMemberId";
ALTER TABLE "Registration" DROP COLUMN IF EXISTS "claimedManagementPublicCode";

-- ============================================================
-- 11. Drop TicketRole and TicketPriceType enums
-- ============================================================
DROP TYPE IF EXISTS "TicketRole";
DROP TYPE IF EXISTS "TicketPriceType";
