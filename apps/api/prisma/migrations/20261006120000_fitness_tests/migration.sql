-- Previerky výkonnosti hráčov

-- CreateTable
CREATE TABLE "FitnessTest" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "teamId" TEXT,
    "testedAt" DATE NOT NULL,
    "run10m" DOUBLE PRECISION,
    "run20m" DOUBLE PRECISION,
    "run30m" DOUBLE PRECISION,
    "shuttleRun" DOUBLE PRECISION,
    "standingJump" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FitnessTest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FitnessTest_memberId_testedAt_idx" ON "FitnessTest"("memberId", "testedAt");
CREATE INDEX "FitnessTest_testedAt_idx" ON "FitnessTest"("testedAt");

-- AddForeignKey
ALTER TABLE "FitnessTest" ADD CONSTRAINT "FitnessTest_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FitnessTest" ADD CONSTRAINT "FitnessTest_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
