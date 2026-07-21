-- AlterTable
ALTER TABLE "BankTransaction" ADD COLUMN     "matchedMemberId" TEXT,
ADD COLUMN     "suggestedMemberId" TEXT;

-- CreateTable
CREATE TABLE "BankPayerLink" (
    "id" TEXT NOT NULL,
    "iban" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankPayerLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BankPayerLink_iban_key" ON "BankPayerLink"("iban");

-- AddForeignKey
ALTER TABLE "BankTransaction" ADD CONSTRAINT "BankTransaction_suggestedMemberId_fkey" FOREIGN KEY ("suggestedMemberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankTransaction" ADD CONSTRAINT "BankTransaction_matchedMemberId_fkey" FOREIGN KEY ("matchedMemberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankPayerLink" ADD CONSTRAINT "BankPayerLink_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

