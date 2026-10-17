-- CreateTable
CREATE TABLE "Pitch" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "surface" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Pitch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Pitch_name_key" ON "Pitch"("name");

-- AlterTable
ALTER TABLE "Event" ADD COLUMN "pitchId" TEXT;

-- CreateIndex
CREATE INDEX "Event_pitchId_startAt_idx" ON "Event"("pitchId", "startAt");

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_pitchId_fkey" FOREIGN KEY ("pitchId") REFERENCES "Pitch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
