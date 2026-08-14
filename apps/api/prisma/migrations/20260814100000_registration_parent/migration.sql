-- Registrácia rodiča bez dieťaťa / registrácia viacerých detí:
-- údaje hráča (dieťaťa) sú voliteľné (chýbajú pri type PARENT),
-- pribúda pole s menami existujúcich detí.
ALTER TABLE "RegistrationRequest" ALTER COLUMN "childFirstName" DROP NOT NULL;
ALTER TABLE "RegistrationRequest" ALTER COLUMN "childLastName" DROP NOT NULL;
ALTER TABLE "RegistrationRequest" ALTER COLUMN "childBirthDate" DROP NOT NULL;
ALTER TABLE "RegistrationRequest" ADD COLUMN "parentChildrenNote" TEXT;
