-- Dres (tmavý/svetlý), video odkaz a fotky zo zápasu

-- CreateEnum
CREATE TYPE "JerseyColor" AS ENUM ('DARK', 'LIGHT');

-- AlterTable
ALTER TABLE "Match" ADD COLUMN "jerseyColor" "JerseyColor";
ALTER TABLE "Match" ADD COLUMN "videoUrl" TEXT;

-- CreateTable
CREATE TABLE "MatchPhoto" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MatchPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MatchPhoto_matchId_idx" ON "MatchPhoto"("matchId");

-- AddForeignKey
ALTER TABLE "MatchPhoto" ADD CONSTRAINT "MatchPhoto_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;
