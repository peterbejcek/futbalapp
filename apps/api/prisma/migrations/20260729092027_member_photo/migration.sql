-- AlterTable
ALTER TABLE "RegistrationRequest" ADD COLUMN     "photoDataUrl" TEXT;

-- CreateTable
CREATE TABLE "MemberPhoto" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "dataUrl" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemberPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MemberPhoto_memberId_key" ON "MemberPhoto"("memberId");

-- AddForeignKey
ALTER TABLE "MemberPhoto" ADD CONSTRAINT "MemberPhoto_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

