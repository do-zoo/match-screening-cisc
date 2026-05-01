-- CreateTable
CREATE TABLE "CommitteeTicketDefaults" (
    "singletonKey" TEXT NOT NULL DEFAULT 'default',
    "ticketMemberPrice" INTEGER NOT NULL,
    "ticketNonMemberPrice" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommitteeTicketDefaults_pkey" PRIMARY KEY ("singletonKey")
);
