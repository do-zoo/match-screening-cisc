-- Hapus sistem voucher: kolom penukaran di tiket legacy + flag eligible di menu venue.
ALTER TABLE "Ticket" DROP CONSTRAINT IF EXISTS "Ticket_voucherRedeemedMenuItemId_fkey";

DROP INDEX IF EXISTS "Ticket_voucherRedeemedMenuItemId_idx";

ALTER TABLE "Ticket" DROP COLUMN IF EXISTS "voucherRedeemedMenuItemId";
ALTER TABLE "Ticket" DROP COLUMN IF EXISTS "voucherRedeemedAt";

ALTER TABLE "VenueMenuItem" DROP COLUMN IF EXISTS "voucherEligible";
