-- Žiadosti o presun hráča medzi družstvami (so schválením trénera / vedenia).
CREATE TABLE "TeamTransferRequest" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "fromTeamId" TEXT,
    "toTeamId" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'MOVE',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "requestedById" TEXT NOT NULL,
    "resolvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    CONSTRAINT "TeamTransferRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TeamTransferRequest_status_idx" ON "TeamTransferRequest"("status");
CREATE INDEX "TeamTransferRequest_memberId_idx" ON "TeamTransferRequest"("memberId");
