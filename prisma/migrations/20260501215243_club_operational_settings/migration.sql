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
