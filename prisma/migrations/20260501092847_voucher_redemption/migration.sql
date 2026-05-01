-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "voucherRedeemedAt" TIMESTAMP(3),
ADD COLUMN     "voucherRedeemedMenuItemId" TEXT;

-- CreateIndex
CREATE INDEX "Ticket_voucherRedeemedMenuItemId_idx" ON "Ticket"("voucherRedeemedMenuItemId");

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_voucherRedeemedMenuItemId_fkey" FOREIGN KEY ("voucherRedeemedMenuItemId") REFERENCES "EventMenuItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
