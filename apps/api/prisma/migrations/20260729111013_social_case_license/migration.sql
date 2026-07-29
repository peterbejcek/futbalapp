-- AlterTable
ALTER TABLE "Member" ADD COLUMN     "licenseLevel" TEXT,
ADD COLUMN     "socialCase" BOOLEAN NOT NULL DEFAULT false;

