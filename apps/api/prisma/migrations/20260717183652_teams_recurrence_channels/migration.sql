-- CreateEnum
CREATE TYPE "ChannelKind" AS ENUM ('TEAM_ANNOUNCEMENTS', 'TEAM_TRAINING', 'TEAM_GENERAL', 'CLUB_ANNOUNCEMENT', 'COACHES', 'BOARD');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "MatchEventType" ADD VALUE 'FOUL';
ALTER TYPE "MatchEventType" ADD VALUE 'SHOT';
ALTER TYPE "MatchEventType" ADD VALUE 'CORNER';
ALTER TYPE "MatchEventType" ADD VALUE 'PENALTY_SCORED';
ALTER TYPE "MatchEventType" ADD VALUE 'PENALTY_MISSED';

-- DropForeignKey
ALTER TABLE "Channel" DROP CONSTRAINT "Channel_teamCategoryId_fkey";

-- DropForeignKey
ALTER TABLE "Event" DROP CONSTRAINT "Event_teamCategoryId_fkey";

-- DropForeignKey
ALTER TABLE "TeamMembership" DROP CONSTRAINT "TeamMembership_teamCategoryId_fkey";

-- DropForeignKey
ALTER TABLE "UserRole" DROP CONSTRAINT "UserRole_teamCategoryId_fkey";

-- DropIndex
DROP INDEX "Event_teamCategoryId_startAt_idx";

-- DropIndex
DROP INDEX "UserRole_userId_role_teamCategoryId_key";

-- AlterTable
ALTER TABLE "Channel" DROP COLUMN "teamCategoryId",
DROP COLUMN "type",
ADD COLUMN     "kind" "ChannelKind" NOT NULL,
ADD COLUMN     "teamId" TEXT;

-- AlterTable
ALTER TABLE "Event" DROP COLUMN "teamCategoryId",
ADD COLUMN     "recurrenceGroupId" TEXT,
ADD COLUMN     "teamId" TEXT;

-- AlterTable
ALTER TABLE "TeamMembership" DROP COLUMN "teamCategoryId",
ADD COLUMN     "teamId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "UserRole" DROP COLUMN "teamCategoryId",
ADD COLUMN     "teamId" TEXT;

-- DropEnum
DROP TYPE "ChannelType";

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "teamCategoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Team_teamCategoryId_name_key" ON "Team"("teamCategoryId", "name");

-- CreateIndex
CREATE INDEX "Channel_teamId_idx" ON "Channel"("teamId");

-- CreateIndex
CREATE INDEX "Event_teamId_startAt_idx" ON "Event"("teamId", "startAt");

-- CreateIndex
CREATE INDEX "Event_recurrenceGroupId_idx" ON "Event"("recurrenceGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "UserRole_userId_role_teamId_key" ON "UserRole"("userId", "role", "teamId");

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_teamCategoryId_fkey" FOREIGN KEY ("teamCategoryId") REFERENCES "TeamCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMembership" ADD CONSTRAINT "TeamMembership_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Channel" ADD CONSTRAINT "Channel_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

