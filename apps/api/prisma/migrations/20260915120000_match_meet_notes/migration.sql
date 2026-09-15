-- Čas zrazu (stretnutia) a poznámky k zápasu
ALTER TABLE "Match" ADD COLUMN "meetAt" TIMESTAMP(3);
ALTER TABLE "Match" ADD COLUMN "notes" TEXT;
