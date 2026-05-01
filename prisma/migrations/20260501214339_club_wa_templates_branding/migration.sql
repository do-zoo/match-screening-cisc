-- CreateEnum
CREATE TYPE "WaTemplateKey" AS ENUM ('receipt', 'payment_issue', 'approved', 'rejected', 'cancelled', 'refunded', 'underpayment_invoice');

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
