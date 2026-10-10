-- Previerky: vedenie lopty (lomený slalom) a vytrvalostný beh

-- AlterTable
ALTER TABLE "FitnessTest" ADD COLUMN "dribbleSlalom" DOUBLE PRECISION;
ALTER TABLE "FitnessTest" ADD COLUMN "enduranceRun" INTEGER;
ALTER TABLE "FitnessTest" ADD COLUMN "enduranceMinutes" INTEGER;
