-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "DocumentCategory" AS ENUM ('CONTRACT', 'SUBSIDY', 'TAX_FORM', 'ANNOUNCEMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "ClubPersonGroup" AS ENUM ('MANAGEMENT', 'COACH', 'OTHER');

-- AlterTable
ALTER TABLE "Article" ADD COLUMN     "isArchive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sourceUrl" TEXT;

-- CreateTable
CREATE TABLE "ClubPage" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "sourceUrl" TEXT,
    "sourceNote" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClubPage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClubPerson" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "group" "ClubPersonGroup" NOT NULL DEFAULT 'MANAGEMENT',
    "teamNote" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "sourceUrl" TEXT,
    "sourceNote" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClubPerson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClubDocument" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" "DocumentCategory" NOT NULL DEFAULT 'OTHER',
    "documentDate" TIMESTAMP(3),
    "originalFilename" TEXT,
    "mimeType" TEXT,
    "size" INTEGER,
    "sha256" TEXT,
    "data" BYTEA,
    "sourceUrl" TEXT,
    "sourceNote" TEXT,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "confirmedAt" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClubDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClubPage_slug_key" ON "ClubPage"("slug");

-- CreateIndex
CREATE INDEX "ClubDocument_status_category_idx" ON "ClubDocument"("status", "category");

