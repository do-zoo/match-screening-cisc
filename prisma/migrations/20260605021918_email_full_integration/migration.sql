-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EmailTemplateKey" ADD VALUE 'receipt';
ALTER TYPE "EmailTemplateKey" ADD VALUE 'rejected';
ALTER TYPE "EmailTemplateKey" ADD VALUE 'payment_issue';
ALTER TYPE "EmailTemplateKey" ADD VALUE 'cancelled';
ALTER TYPE "EmailTemplateKey" ADD VALUE 'refunded';
ALTER TYPE "EmailTemplateKey" ADD VALUE 'admin_invite';
ALTER TYPE "EmailTemplateKey" ADD VALUE 'otp';

-- AlterTable
ALTER TABLE "ClubNotificationPreferences" ADD COLUMN     "emailAutoOnApprove" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "emailAutoOnCancel" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "emailAutoOnPaymentIssue" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "emailAutoOnRefund" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "emailAutoOnReject" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "emailAutoOnSubmitReceipt" BOOLEAN NOT NULL DEFAULT false;
