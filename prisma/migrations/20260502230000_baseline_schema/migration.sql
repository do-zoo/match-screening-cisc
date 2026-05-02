-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

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
CREATE TYPE "UploadPurpose" AS ENUM ('transfer_proof', 'member_card_photo', 'partner_member_card_photo', 'invoice_adjustment_proof');

-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('Owner', 'Admin', 'Verifier', 'Viewer');

-- CreateEnum
CREATE TYPE "WaTemplateKey" AS ENUM ('receipt', 'payment_issue', 'approved', 'rejected', 'cancelled', 'refunded', 'underpayment_invoice');

-- CreateEnum
CREATE TYPE "NotificationOutboundMode" AS ENUM ('off', 'log_only', 'live');

-- CreateTable
CREATE TABLE "MasterMember" (
    "id" TEXT NOT NULL,
    "memberNumber" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "whatsapp" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isManagementMember" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MasterMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PicBankAccount" (
    "id" TEXT NOT NULL,
    "ownerAdminProfileId" TEXT NOT NULL,
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
    "summary" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "venueName" TEXT NOT NULL,
    "venueAddress" TEXT NOT NULL,
    "coverBlobUrl" TEXT NOT NULL,
    "coverBlobPath" TEXT NOT NULL,
    "registrationManualClosed" BOOLEAN NOT NULL DEFAULT false,
    "registrationCapacity" INTEGER,
    "status" "EventStatus" NOT NULL DEFAULT 'draft',
    "ticketMemberPrice" INTEGER NOT NULL,
    "ticketNonMemberPrice" INTEGER NOT NULL,
    "pricingSource" "PricingSource" NOT NULL DEFAULT 'global_default',
    "menuMode" "MenuMode" NOT NULL,
    "menuSelection" "MenuSelection" NOT NULL,
    "voucherPrice" INTEGER,
    "picAdminProfileId" TEXT NOT NULL,
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
    "voucherRedeemedMenuItemId" TEXT,
    "voucherRedeemedAt" TIMESTAMP(3),

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

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
CREATE TABLE "CommitteeTicketDefaults" (
    "singletonKey" TEXT NOT NULL DEFAULT 'default',
    "ticketMemberPrice" INTEGER NOT NULL,
    "ticketNonMemberPrice" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommitteeTicketDefaults_pkey" PRIMARY KEY ("singletonKey")
);

-- CreateTable
CREATE TABLE "ClubWaTemplate" (
    "key" "WaTemplateKey" NOT NULL,
    "body" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClubWaTemplate_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "ClubBranding" (
    "singletonKey" TEXT NOT NULL DEFAULT 'default',
    "clubNameNav" TEXT NOT NULL DEFAULT 'CISC Nobar',
    "footerPlainText" TEXT,
    "logoBlobUrl" TEXT,
    "logoBlobPath" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClubBranding_pkey" PRIMARY KEY ("singletonKey")
);

-- CreateTable
CREATE TABLE "ClubOperationalSettings" (
    "singletonKey" TEXT NOT NULL DEFAULT 'default',
    "registrationGloballyDisabled" BOOLEAN NOT NULL DEFAULT false,
    "globalRegistrationClosedMessage" TEXT,
    "maintenanceBannerPlainText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClubOperationalSettings_pkey" PRIMARY KEY ("singletonKey")
);

-- CreateTable
CREATE TABLE "ClubNotificationPreferences" (
    "singletonKey" TEXT NOT NULL DEFAULT 'default',
    "outboundMode" "NotificationOutboundMode" NOT NULL DEFAULT 'log_only',
    "outboundLabel" VARCHAR(120),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClubNotificationPreferences_pkey" PRIMARY KEY ("singletonKey")
);

-- CreateTable
CREATE TABLE "ClubAuditLog" (
    "id" TEXT NOT NULL,
    "actorAdminProfileId" TEXT,
    "actorAuthUserId" TEXT NOT NULL,
    "action" VARCHAR(96) NOT NULL,
    "targetType" VARCHAR(64),
    "targetId" VARCHAR(128),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClubAuditLog_pkey" PRIMARY KEY ("id")
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

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "twoFactorEnabled" BOOLEAN DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "twoFactor" (
    "id" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "backupCodes" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "verified" BOOLEAN DEFAULT true,

    CONSTRAINT "twoFactor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MasterMember_memberNumber_key" ON "MasterMember"("memberNumber");

-- CreateIndex
CREATE INDEX "PicBankAccount_ownerAdminProfileId_idx" ON "PicBankAccount"("ownerAdminProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "Event_slug_key" ON "Event"("slug");

-- CreateIndex
CREATE INDEX "Event_status_startAt_idx" ON "Event"("status", "startAt");

-- CreateIndex
CREATE INDEX "Event_picAdminProfileId_idx" ON "Event"("picAdminProfileId");

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
CREATE INDEX "Ticket_voucherRedeemedMenuItemId_idx" ON "Ticket"("voucherRedeemedMenuItemId");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_eventId_memberNumber_key" ON "Ticket"("eventId", "memberNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_registrationId_role_key" ON "Ticket"("registrationId", "role");

-- CreateIndex
CREATE INDEX "EventMenuItem_eventId_idx" ON "EventMenuItem"("eventId");

-- CreateIndex
CREATE INDEX "TicketMenuSelection_menuItemId_idx" ON "TicketMenuSelection"("menuItemId");

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
CREATE INDEX "ClubAuditLog_createdAt_idx" ON "ClubAuditLog"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "ClubAuditLog_action_idx" ON "ClubAuditLog"("action");

-- CreateIndex
CREATE UNIQUE INDEX "AdminProfile_authUserId_key" ON "AdminProfile"("authUserId");

-- CreateIndex
CREATE INDEX "AdminProfile_role_idx" ON "AdminProfile"("role");

-- CreateIndex
CREATE INDEX "AdminProfile_memberId_idx" ON "AdminProfile"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE INDEX "twoFactor_secret_idx" ON "twoFactor"("secret");

-- CreateIndex
CREATE INDEX "twoFactor_userId_idx" ON "twoFactor"("userId");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "account"("userId");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

-- AddForeignKey
ALTER TABLE "PicBankAccount" ADD CONSTRAINT "PicBankAccount_ownerAdminProfileId_fkey" FOREIGN KEY ("ownerAdminProfileId") REFERENCES "AdminProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_picAdminProfileId_fkey" FOREIGN KEY ("picAdminProfileId") REFERENCES "AdminProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

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
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_voucherRedeemedMenuItemId_fkey" FOREIGN KEY ("voucherRedeemedMenuItemId") REFERENCES "EventMenuItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventMenuItem" ADD CONSTRAINT "EventMenuItem_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketMenuSelection" ADD CONSTRAINT "TicketMenuSelection_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketMenuSelection" ADD CONSTRAINT "TicketMenuSelection_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "EventMenuItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceAdjustment" ADD CONSTRAINT "InvoiceAdjustment_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "Registration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Upload" ADD CONSTRAINT "Upload_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "Registration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Upload" ADD CONSTRAINT "Upload_invoiceAdjustmentId_fkey" FOREIGN KEY ("invoiceAdjustmentId") REFERENCES "InvoiceAdjustment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubAuditLog" ADD CONSTRAINT "ClubAuditLog_actorAdminProfileId_fkey" FOREIGN KEY ("actorAdminProfileId") REFERENCES "AdminProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminProfile" ADD CONSTRAINT "AdminProfile_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "MasterMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "twoFactor" ADD CONSTRAINT "twoFactor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
