-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('draft', 'active', 'finished');

-- CreateEnum
CREATE TYPE "PricingSource" AS ENUM ('global_default', 'overridden');

-- CreateEnum
CREATE TYPE "MenuMode" AS ENUM ('PRESELECT', 'VOUCHER');

-- CreateEnum
CREATE TYPE "MenuSelection" AS ENUM ('SINGLE', 'MULTI');

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('submitted', 'pending_review', 'payment_issue', 'approved', 'rejected', 'cancelled', 'refunded');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('unknown', 'attended', 'no_show');

-- CreateEnum
CREATE TYPE "MemberValidation" AS ENUM ('unknown', 'valid', 'invalid', 'overridden');

-- CreateEnum
CREATE TYPE "TicketRole" AS ENUM ('primary', 'partner');

-- CreateEnum
CREATE TYPE "TicketPriceType" AS ENUM ('member', 'non_member', 'privilege_partner_member_price');

-- CreateEnum
CREATE TYPE "InvoiceAdjustmentType" AS ENUM ('underpayment', 'other_adjustment');

-- CreateEnum
CREATE TYPE "InvoiceAdjustmentStatus" AS ENUM ('unpaid', 'paid');

-- CreateEnum
CREATE TYPE "UploadPurpose" AS ENUM ('transfer_proof', 'member_card_photo', 'invoice_adjustment_proof');

-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('Owner', 'Verifier', 'Viewer');

-- CreateTable
CREATE TABLE "MasterMember" (
    "id" TEXT NOT NULL,
    "memberNumber" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isPengurus" BOOLEAN NOT NULL DEFAULT false,
    "canBePIC" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MasterMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PicBankAccount" (
    "id" TEXT NOT NULL,
    "ownerMemberId" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PicBankAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "venueName" TEXT NOT NULL,
    "venueAddress" TEXT NOT NULL,
    "status" "EventStatus" NOT NULL DEFAULT 'draft',
    "ticketMemberPrice" INTEGER NOT NULL,
    "ticketNonMemberPrice" INTEGER NOT NULL,
    "pricingSource" "PricingSource" NOT NULL DEFAULT 'global_default',
    "menuMode" "MenuMode" NOT NULL,
    "menuSelection" "MenuSelection" NOT NULL,
    "voucherPrice" INTEGER,
    "picMasterMemberId" TEXT NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventPicHelper" (
    "eventId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventPicHelper_pkey" PRIMARY KEY ("eventId","memberId")
);

-- CreateTable
CREATE TABLE "Registration" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "contactName" TEXT NOT NULL,
    "contactWhatsapp" TEXT NOT NULL,
    "claimedMemberNumber" TEXT,
    "memberValidation" "MemberValidation" NOT NULL DEFAULT 'unknown',
    "memberId" TEXT,
    "ticketMemberPriceApplied" INTEGER NOT NULL,
    "ticketNonMemberPriceApplied" INTEGER NOT NULL,
    "voucherPriceApplied" INTEGER,
    "computedTotalAtSubmit" INTEGER NOT NULL,
    "status" "RegistrationStatus" NOT NULL DEFAULT 'submitted',
    "attendanceStatus" "AttendanceStatus" NOT NULL DEFAULT 'unknown',
    "rejectionReason" TEXT,
    "paymentIssueReason" TEXT,

    CONSTRAINT "Registration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "role" "TicketRole" NOT NULL,
    "fullName" TEXT NOT NULL,
    "whatsapp" TEXT,
    "memberNumber" TEXT,
    "ticketPriceType" "TicketPriceType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "eventId" TEXT NOT NULL,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceAdjustment" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "type" "InvoiceAdjustmentType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" "InvoiceAdjustmentStatus" NOT NULL DEFAULT 'unpaid',
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoiceAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Upload" (
    "id" TEXT NOT NULL,
    "purpose" "UploadPurpose" NOT NULL,
    "blobUrl" TEXT NOT NULL,
    "blobPath" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "originalFilename" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "registrationId" TEXT,
    "invoiceAdjustmentId" TEXT,

    CONSTRAINT "Upload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminProfile" (
    "id" TEXT NOT NULL,
    "authUserId" TEXT NOT NULL,
    "role" "AdminRole" NOT NULL DEFAULT 'Viewer',
    "memberId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MasterMember_memberNumber_key" ON "MasterMember"("memberNumber");

-- CreateIndex
CREATE INDEX "PicBankAccount_ownerMemberId_idx" ON "PicBankAccount"("ownerMemberId");

-- CreateIndex
CREATE UNIQUE INDEX "Event_slug_key" ON "Event"("slug");

-- CreateIndex
CREATE INDEX "Event_status_idx" ON "Event"("status");

-- CreateIndex
CREATE INDEX "Event_picMasterMemberId_idx" ON "Event"("picMasterMemberId");

-- CreateIndex
CREATE INDEX "Event_bankAccountId_idx" ON "Event"("bankAccountId");

-- CreateIndex
CREATE INDEX "EventPicHelper_memberId_idx" ON "EventPicHelper"("memberId");

-- CreateIndex
CREATE INDEX "Registration_eventId_createdAt_idx" ON "Registration"("eventId", "createdAt");

-- CreateIndex
CREATE INDEX "Registration_status_idx" ON "Registration"("status");

-- CreateIndex
CREATE INDEX "Registration_attendanceStatus_idx" ON "Registration"("attendanceStatus");

-- CreateIndex
CREATE INDEX "Ticket_registrationId_idx" ON "Ticket"("registrationId");

-- CreateIndex
CREATE INDEX "Ticket_eventId_idx" ON "Ticket"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_eventId_memberNumber_key" ON "Ticket"("eventId", "memberNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_registrationId_role_key" ON "Ticket"("registrationId", "role");

-- CreateIndex
CREATE INDEX "InvoiceAdjustment_registrationId_idx" ON "InvoiceAdjustment"("registrationId");

-- CreateIndex
CREATE INDEX "InvoiceAdjustment_status_idx" ON "InvoiceAdjustment"("status");

-- CreateIndex
CREATE INDEX "Upload_purpose_createdAt_idx" ON "Upload"("purpose", "createdAt");

-- CreateIndex
CREATE INDEX "Upload_registrationId_idx" ON "Upload"("registrationId");

-- CreateIndex
CREATE INDEX "Upload_invoiceAdjustmentId_idx" ON "Upload"("invoiceAdjustmentId");

-- CreateIndex
CREATE UNIQUE INDEX "AdminProfile_authUserId_key" ON "AdminProfile"("authUserId");

-- CreateIndex
CREATE INDEX "AdminProfile_role_idx" ON "AdminProfile"("role");

-- CreateIndex
CREATE INDEX "AdminProfile_memberId_idx" ON "AdminProfile"("memberId");

-- AddForeignKey
ALTER TABLE "PicBankAccount" ADD CONSTRAINT "PicBankAccount_ownerMemberId_fkey" FOREIGN KEY ("ownerMemberId") REFERENCES "MasterMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_picMasterMemberId_fkey" FOREIGN KEY ("picMasterMemberId") REFERENCES "MasterMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "PicBankAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventPicHelper" ADD CONSTRAINT "EventPicHelper_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventPicHelper" ADD CONSTRAINT "EventPicHelper_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "MasterMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "MasterMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "Registration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceAdjustment" ADD CONSTRAINT "InvoiceAdjustment_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "Registration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Upload" ADD CONSTRAINT "Upload_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "Registration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Upload" ADD CONSTRAINT "Upload_invoiceAdjustmentId_fkey" FOREIGN KEY ("invoiceAdjustmentId") REFERENCES "InvoiceAdjustment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminProfile" ADD CONSTRAINT "AdminProfile_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "MasterMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;
