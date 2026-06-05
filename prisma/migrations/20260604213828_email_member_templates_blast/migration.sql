-- CreateEnum
CREATE TYPE "EmailTemplateKey" AS ENUM ('invoice_underpayment', 'magic_link');

-- AlterTable
ALTER TABLE "MasterMember" ADD COLUMN     "email" TEXT;

-- AlterTable
ALTER TABLE "Registration" ADD COLUMN     "contactEmail" TEXT;

-- AlterTable
ALTER TABLE "RegistrationHolder" ADD COLUMN     "holderEmail" TEXT;

-- CreateTable
CREATE TABLE "ClubEmailTemplate" (
    "key" "EmailTemplateKey" NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClubEmailTemplate_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "EmailDeliveryLog" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "templateKey" "EmailTemplateKey" NOT NULL,
    "toEmail" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "errorMessage" VARCHAR(500),
    "actorAdminProfileId" TEXT,
    "actorAuthUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailDeliveryLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailDeliveryLog_eventId_createdAt_idx" ON "EmailDeliveryLog"("eventId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "EmailDeliveryLog_registrationId_idx" ON "EmailDeliveryLog"("registrationId");
