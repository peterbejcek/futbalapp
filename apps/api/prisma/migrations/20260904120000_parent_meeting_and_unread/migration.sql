-- Nový typ udalosti: rodičovské združenie
ALTER TYPE "EventType" ADD VALUE IF NOT EXISTS 'PARENT_MEETING';

-- Cieľové družstvá udalosti (m2m) — napr. rodičovské združenie pre viac družstiev naraz.
CREATE TABLE "_EventAudience" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);
CREATE UNIQUE INDEX "_EventAudience_AB_unique" ON "_EventAudience"("A", "B");
CREATE INDEX "_EventAudience_B_index" ON "_EventAudience"("B");
ALTER TABLE "_EventAudience" ADD CONSTRAINT "_EventAudience_A_fkey" FOREIGN KEY ("A") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_EventAudience" ADD CONSTRAINT "_EventAudience_B_fkey" FOREIGN KEY ("B") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Stav prečítania kanála používateľom (na zvýraznenie neprečítaných správ)
CREATE TABLE "ChannelRead" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastReadAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChannelRead_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ChannelRead_channelId_userId_key" ON "ChannelRead"("channelId", "userId");
ALTER TABLE "ChannelRead" ADD CONSTRAINT "ChannelRead_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChannelRead" ADD CONSTRAINT "ChannelRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
