-- DropIndex
DROP INDEX "TeamMembership_memberId_seasonId_key";

-- CreateIndex
CREATE INDEX "TeamMembership_memberId_seasonId_idx" ON "TeamMembership"("memberId", "seasonId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMembership_memberId_seasonId_teamId_key" ON "TeamMembership"("memberId", "seasonId", "teamId");

