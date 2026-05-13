-- CreateEnum
CREATE TYPE "EventSettlementArtifactKind" AS ENUM ('venue_transfer', 'venue_receipt', 'treasurer_margin');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "UploadPurpose" ADD VALUE 'event_settlement_venue_transfer';
ALTER TYPE "UploadPurpose" ADD VALUE 'event_settlement_venue_receipt';
ALTER TYPE "UploadPurpose" ADD VALUE 'event_settlement_treasurer_margin';

-- CreateTable
CREATE TABLE "EventSettlementArtifact" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "kind" "EventSettlementArtifactKind" NOT NULL,
    "declaredAmountIdr" INTEGER,
    "expectedAmountIdr" INTEGER,
    "amountDeltaIdr" INTEGER,
    "mismatchAcknowledged" BOOLEAN NOT NULL DEFAULT false,
    "mismatchReason" TEXT,
    "uploadId" TEXT NOT NULL,
    "uploadedByAdminProfileId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventSettlementArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EventSettlementArtifact_uploadId_key" ON "EventSettlementArtifact"("uploadId");

-- CreateIndex
CREATE INDEX "EventSettlementArtifact_eventId_kind_createdAt_idx" ON "EventSettlementArtifact"("eventId", "kind", "createdAt");

-- AddForeignKey
ALTER TABLE "EventSettlementArtifact" ADD CONSTRAINT "EventSettlementArtifact_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventSettlementArtifact" ADD CONSTRAINT "EventSettlementArtifact_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "Upload"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventSettlementArtifact" ADD CONSTRAINT "EventSettlementArtifact_uploadedByAdminProfileId_fkey" FOREIGN KEY ("uploadedByAdminProfileId") REFERENCES "AdminProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
