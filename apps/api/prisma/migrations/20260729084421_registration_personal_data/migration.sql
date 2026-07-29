-- AlterTable
ALTER TABLE "Member" ADD COLUMN     "addressCity" TEXT,
ADD COLUMN     "addressHouseNumber" TEXT,
ADD COLUMN     "addressStreet" TEXT,
ADD COLUMN     "addressZip" TEXT,
ADD COLUMN     "birthNumber" TEXT,
ADD COLUMN     "originCountry" TEXT,
ADD COLUMN     "sex" TEXT;

-- AlterTable
ALTER TABLE "RegistrationRequest" ADD COLUMN     "addressCity" TEXT,
ADD COLUMN     "addressHouseNumber" TEXT,
ADD COLUMN     "addressStreet" TEXT,
ADD COLUMN     "addressZip" TEXT,
ADD COLUMN     "birthNumber" TEXT,
ADD COLUMN     "originCountry" TEXT,
ADD COLUMN     "playerRegistrationNumber" TEXT,
ADD COLUMN     "sex" TEXT;

