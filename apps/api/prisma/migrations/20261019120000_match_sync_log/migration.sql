-- AlterTable
ALTER TABLE "Match" ADD COLUMN "sportnetUrl" TEXT;

-- CreateTable
CREATE TABLE "MatchSyncLog" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "changes" TEXT[],

    CONSTRAINT "MatchSyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MatchSyncLog_matchId_createdAt_idx" ON "MatchSyncLog"("matchId", "createdAt");

-- AddForeignKey
ALTER TABLE "MatchSyncLog" ADD CONSTRAINT "MatchSyncLog_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;
