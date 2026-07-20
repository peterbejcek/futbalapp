-- AlterTable
ALTER TABLE "Member" ADD COLUMN     "clubAffiliation" TEXT,
ADD COLUMN     "guestClub" TEXT,
ADD COLUMN     "homeClub" TEXT,
ADD COLUMN     "registeredAt" TIMESTAMP(3),
ADD COLUMN     "registrationNumber" TEXT,
ADD COLUMN     "registrationValidUntil" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Member_registrationNumber_key" ON "Member"("registrationNumber");

