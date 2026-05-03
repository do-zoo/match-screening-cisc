-- DropForeignKey
ALTER TABLE "EventMenuItem" DROP CONSTRAINT "EventMenuItem_eventId_fkey";

-- DropForeignKey
ALTER TABLE "Ticket" DROP CONSTRAINT "Ticket_voucherRedeemedMenuItemId_fkey";

-- DropForeignKey
ALTER TABLE "TicketMenuSelection" DROP CONSTRAINT "TicketMenuSelection_menuItemId_fkey";

-- AlterTable
ALTER TABLE "Event" DROP COLUMN "venueAddress",
DROP COLUMN "venueName",
ALTER COLUMN "venueId" SET NOT NULL;

-- DropTable
DROP TABLE "EventMenuItem";

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_voucherRedeemedMenuItemId_fkey" FOREIGN KEY ("voucherRedeemedMenuItemId") REFERENCES "VenueMenuItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketMenuSelection" ADD CONSTRAINT "TicketMenuSelection_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "VenueMenuItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
