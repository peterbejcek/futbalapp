-- CreateEnum
CREATE TYPE "NominationRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "NominationRequest" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "status" "NominationRequestStatus" NOT NULL DEFAULT 'PENDING',
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NominationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NominationRequest_status_idx" ON "NominationRequest"("status");

-- CreateIndex
CREATE UNIQUE INDEX "NominationRequest_matchId_memberId_key" ON "NominationRequest"("matchId", "memberId");

-- AddForeignKey
ALTER TABLE "NominationRequest" ADD CONSTRAINT "NominationRequest_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NominationRequest" ADD CONSTRAINT "NominationRequest_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NominationRequest" ADD CONSTRAINT "NominationRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NominationRequest" ADD CONSTRAINT "NominationRequest_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
