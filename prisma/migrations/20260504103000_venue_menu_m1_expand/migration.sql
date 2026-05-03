-- AlterTable
ALTER TABLE "Event" ADD COLUMN "venueId" TEXT;

-- CreateTable
CREATE TABLE "Venue" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Venue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VenueMenuItem" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "voucherEligible" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VenueMenuItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventVenueMenuItem" (
    "eventId" TEXT NOT NULL,
    "venueMenuItemId" TEXT NOT NULL,
    "sortOrder" INTEGER,

    CONSTRAINT "EventVenueMenuItem_pkey" PRIMARY KEY ("eventId","venueMenuItemId")
);

-- CreateIndex
CREATE INDEX "VenueMenuItem_venueId_idx" ON "VenueMenuItem"("venueId");

-- CreateIndex
CREATE INDEX "EventVenueMenuItem_venueMenuItemId_idx" ON "EventVenueMenuItem"("venueMenuItemId");

-- CreateIndex
CREATE INDEX "Event_venueId_idx" ON "Event"("venueId");

-- AddForeignKey
ALTER TABLE "VenueMenuItem" ADD CONSTRAINT "VenueMenuItem_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventVenueMenuItem" ADD CONSTRAINT "EventVenueMenuItem_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventVenueMenuItem" ADD CONSTRAINT "EventVenueMenuItem_venueMenuItemId_fkey" FOREIGN KEY ("venueMenuItemId") REFERENCES "VenueMenuItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
