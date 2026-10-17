-- Videá zo zápasu nahrané z telefónu (súbor na disku, v DB metadáta)

-- CreateTable
CREATE TABLE "MatchVideo" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "filename" TEXT,
    "storagePath" TEXT NOT NULL,
    "title" TEXT,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MatchVideo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MatchVideo_storagePath_key" ON "MatchVideo"("storagePath");

-- CreateIndex
CREATE INDEX "MatchVideo_matchId_idx" ON "MatchVideo"("matchId");

-- AddForeignKey
ALTER TABLE "MatchVideo" ADD CONSTRAINT "MatchVideo_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;
