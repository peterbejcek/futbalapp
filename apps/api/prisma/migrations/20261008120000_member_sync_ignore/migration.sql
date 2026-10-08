-- Ignorované rozdiely z ISSF synchronizácie (zvolené „ponechať")
CREATE TABLE "MemberSyncIgnore" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MemberSyncIgnore_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MemberSyncIgnore_memberId_field_key" ON "MemberSyncIgnore"("memberId", "field");

ALTER TABLE "MemberSyncIgnore" ADD CONSTRAINT "MemberSyncIgnore_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
