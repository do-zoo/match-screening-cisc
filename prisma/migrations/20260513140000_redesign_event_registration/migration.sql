-- Redesign: explicit event timeline, mandatory menu IDs on Event, per-registrant pricing on Registration, partner link.
-- Clears events/registrations/tickets/uploads/adjustments (dev reset friendly).

DELETE FROM "TicketMenuSelection";
DELETE FROM "Ticket";

DELETE FROM "Upload" WHERE "invoiceAdjustmentId" IN (SELECT "id" FROM "InvoiceAdjustment");
DELETE FROM "InvoiceAdjustment";
DELETE FROM "Upload" WHERE "registrationId" IS NOT NULL;

DELETE FROM "Registration";

DELETE FROM "EventPicHelper";
DELETE FROM "EventVenueMenuItem";
DELETE FROM "Event";

DROP INDEX IF EXISTS "Event_status_startAt_idx";

-- Event: timeline + mandatory menu; remove legacy columns
ALTER TABLE "Event" ADD COLUMN "openRegistrationAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Event" ADD COLUMN "closeRegistrationAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Event" ADD COLUMN "openGateAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Event" ADD COLUMN "kickOffAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Event" ADD COLUMN "mandatoryMenuItemIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "Event" DROP COLUMN "startAt";
ALTER TABLE "Event" DROP COLUMN "endAt";
ALTER TABLE "Event" DROP COLUMN "menuMode";
ALTER TABLE "Event" DROP COLUMN "menuSelection";
ALTER TABLE "Event" DROP COLUMN "voucherPrice";

CREATE INDEX "Event_status_kickOffAt_idx" ON "Event"("status", "kickOffAt");

-- Registration: ticket + menu snapshot on row; partner self-FK
ALTER TABLE "Registration" DROP COLUMN "ticketMemberPriceApplied";
ALTER TABLE "Registration" DROP COLUMN "ticketNonMemberPriceApplied";
ALTER TABLE "Registration" DROP COLUMN "voucherPriceApplied";

ALTER TABLE "Registration" ADD COLUMN "primaryRegistrationId" TEXT;
ALTER TABLE "Registration" ADD COLUMN "ticketRole" "TicketRole" NOT NULL DEFAULT 'primary';
ALTER TABLE "Registration" ADD COLUMN "ticketPriceType" "TicketPriceType" NOT NULL DEFAULT 'member';
ALTER TABLE "Registration" ADD COLUMN "mandatoryMenuItemId" TEXT NOT NULL;
ALTER TABLE "Registration" ADD COLUMN "ticketPriceApplied" INTEGER NOT NULL;
ALTER TABLE "Registration" ADD COLUMN "mandatoryMenuPriceApplied" INTEGER NOT NULL;

ALTER TABLE "Registration" ADD CONSTRAINT "Registration_primaryRegistrationId_fkey"
  FOREIGN KEY ("primaryRegistrationId") REFERENCES "Registration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Registration" ADD CONSTRAINT "Registration_mandatoryMenuItemId_fkey"
  FOREIGN KEY ("mandatoryMenuItemId") REFERENCES "VenueMenuItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "Registration_primaryRegistrationId_idx" ON "Registration"("primaryRegistrationId");

DROP TABLE IF EXISTS "CommitteeTicketDefaults";

DROP TYPE IF EXISTS "MenuSelection";
DROP TYPE IF EXISTS "MenuMode";
