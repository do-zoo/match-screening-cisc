-- AlterTable
ALTER TABLE "Registration" ADD COLUMN     "claimedManagementPublicCode" TEXT,
ADD COLUMN     "primaryManagementMemberId" TEXT;

-- CreateTable
CREATE TABLE "BoardPeriod" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BoardPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BoardRole" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BoardRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManagementMember" (
    "id" TEXT NOT NULL,
    "publicCode" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "whatsapp" TEXT,
    "masterMemberId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManagementMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BoardAssignment" (
    "id" TEXT NOT NULL,
    "boardPeriodId" TEXT NOT NULL,
    "managementMemberId" TEXT NOT NULL,
    "boardRoleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BoardAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BoardPeriod_startsAt_endsAt_idx" ON "BoardPeriod"("startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "BoardRole_isActive_sortOrder_idx" ON "BoardRole"("isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ManagementMember_publicCode_key" ON "ManagementMember"("publicCode");

-- CreateIndex
CREATE UNIQUE INDEX "ManagementMember_masterMemberId_key" ON "ManagementMember"("masterMemberId");

-- CreateIndex
CREATE INDEX "BoardAssignment_managementMemberId_idx" ON "BoardAssignment"("managementMemberId");

-- CreateIndex
CREATE INDEX "BoardAssignment_boardRoleId_idx" ON "BoardAssignment"("boardRoleId");

-- CreateIndex
CREATE UNIQUE INDEX "BoardAssignment_boardPeriodId_managementMemberId_key" ON "BoardAssignment"("boardPeriodId", "managementMemberId");

-- CreateIndex
CREATE UNIQUE INDEX "BoardAssignment_boardPeriodId_boardRoleId_key" ON "BoardAssignment"("boardPeriodId", "boardRoleId");

-- AddForeignKey
ALTER TABLE "ManagementMember" ADD CONSTRAINT "ManagementMember_masterMemberId_fkey" FOREIGN KEY ("masterMemberId") REFERENCES "MasterMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoardAssignment" ADD CONSTRAINT "BoardAssignment_boardPeriodId_fkey" FOREIGN KEY ("boardPeriodId") REFERENCES "BoardPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoardAssignment" ADD CONSTRAINT "BoardAssignment_managementMemberId_fkey" FOREIGN KEY ("managementMemberId") REFERENCES "ManagementMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoardAssignment" ADD CONSTRAINT "BoardAssignment_boardRoleId_fkey" FOREIGN KEY ("boardRoleId") REFERENCES "BoardRole"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_primaryManagementMemberId_fkey" FOREIGN KEY ("primaryManagementMemberId") REFERENCES "ManagementMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;
