-- CreateTable
CREATE TABLE "EventMenuItem" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "voucherEligible" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventMenuItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketMenuSelection" (
    "ticketId" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketMenuSelection_pkey" PRIMARY KEY ("ticketId","menuItemId")
);

-- CreateIndex
CREATE INDEX "EventMenuItem_eventId_idx" ON "EventMenuItem"("eventId");

-- CreateIndex
CREATE INDEX "TicketMenuSelection_menuItemId_idx" ON "TicketMenuSelection"("menuItemId");

-- AddForeignKey
ALTER TABLE "EventMenuItem" ADD CONSTRAINT "EventMenuItem_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketMenuSelection" ADD CONSTRAINT "TicketMenuSelection_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketMenuSelection" ADD CONSTRAINT "TicketMenuSelection_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "EventMenuItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
