-- CreateTable
CREATE TABLE "AdminInvitation" (
    "id" TEXT NOT NULL,
    "emailNormalized" TEXT NOT NULL,
    "role" "AdminRole" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByAdminProfileId" TEXT NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "AdminInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminInvitation_tokenHash_key" ON "AdminInvitation"("tokenHash");

-- CreateIndex
CREATE INDEX "AdminInvitation_emailNormalized_idx" ON "AdminInvitation"("emailNormalized");

-- CreateIndex
CREATE INDEX "AdminInvitation_expiresAt_idx" ON "AdminInvitation"("expiresAt");

-- AddForeignKey
ALTER TABLE "AdminInvitation" ADD CONSTRAINT "AdminInvitation_createdByAdminProfileId_fkey" FOREIGN KEY ("createdByAdminProfileId") REFERENCES "AdminProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
