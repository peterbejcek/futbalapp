-- AlterTable
ALTER TABLE "RegistrationRequest" ADD COLUMN     "applicantType" TEXT NOT NULL DEFAULT 'CHILD',
ADD COLUMN     "playerEmail" TEXT,
ALTER COLUMN "parentFirstName" DROP NOT NULL,
ALTER COLUMN "parentLastName" DROP NOT NULL,
ALTER COLUMN "parentEmail" DROP NOT NULL,
ALTER COLUMN "parentPhone" DROP NOT NULL,
ALTER COLUMN "parentRelation" DROP NOT NULL;

