-- CreateEnum
CREATE TYPE "NotificationOutboundMode" AS ENUM ('off', 'log_only', 'live');

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

-- CreateIndex
CREATE INDEX "ClubAuditLog_createdAt_idx" ON "ClubAuditLog"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "ClubAuditLog_action_idx" ON "ClubAuditLog"("action");

-- AddForeignKey
ALTER TABLE "ClubAuditLog" ADD CONSTRAINT "ClubAuditLog_actorAdminProfileId_fkey" FOREIGN KEY ("actorAdminProfileId") REFERENCES "AdminProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
