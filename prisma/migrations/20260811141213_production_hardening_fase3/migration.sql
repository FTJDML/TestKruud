-- CreateEnum
CREATE TYPE "ImageStatus" AS ENUM ('PENDING', 'VALID', 'INVALID');

-- CreateEnum
CREATE TYPE "ExperienceType" AS ENUM ('NOT_TESTED', 'DESK_RESEARCHED', 'HANDS_ON_TESTED');

-- CreateEnum
CREATE TYPE "AffiliateNetwork" AS ENUM ('DIRECT', 'BOL', 'AWIN', 'DAISYCON', 'TRADETRACKER', 'AMAZON_CREATORS');

-- CreateEnum
CREATE TYPE "ConfidenceLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "MatchMethod" AS ENUM ('EAN', 'BRAND_MODEL', 'MERCHANT_EXTERNAL_ID', 'NORMALIZED_TITLE', 'FUZZY');

-- CreateEnum
CREATE TYPE "MatchCandidateStatus" AS ENUM ('OPEN', 'CONFIRMED', 'REJECTED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EditionSection" ADD VALUE 'BEST_DEALS';
ALTER TYPE "EditionSection" ADD VALUE 'LATEST_PRICE_DROPS';
ALTER TYPE "EditionSection" ADD VALUE 'DISCOVERY';

-- AlterTable
ALTER TABLE "EditorialContent" ADD COLUMN     "analysisVersion" TEXT,
ADD COLUMN     "evidenceSummary" TEXT,
ADD COLUMN     "experienceType" "ExperienceType" NOT NULL DEFAULT 'NOT_TESTED',
ADD COLUMN     "generationModel" TEXT,
ADD COLUMN     "generationProvider" TEXT,
ADD COLUMN     "generationWarnings" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "Merchant" ADD COLUMN     "affiliateNetwork" "AffiliateNetwork" NOT NULL DEFAULT 'DIRECT',
ADD COLUMN     "imageHosts" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Offer" ADD COLUMN     "availabilityLabel" TEXT,
ADD COLUMN     "productGroup" TEXT,
ADD COLUMN     "shippingCost" DECIMAL(10,2),
ADD COLUMN     "variantId" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "experienceType" "ExperienceType" NOT NULL DEFAULT 'NOT_TESTED',
ADD COLUMN     "imageCheckedAt" TIMESTAMP(3),
ADD COLUMN     "imageContentType" TEXT,
ADD COLUMN     "imageFailureReason" TEXT,
ADD COLUMN     "imageHeight" INTEGER,
ADD COLUMN     "imageSourceUrl" TEXT,
ADD COLUMN     "imageStatus" "ImageStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "imageWidth" INTEGER,
ADD COLUMN     "lastValidImageUrl" TEXT;

-- CreateTable
CREATE TABLE "DealAnalysis" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "currentPrice" DECIMAL(10,2) NOT NULL,
    "previousObservedPrice" DECIMAL(10,2),
    "lowestPrice30Days" DECIMAL(10,2),
    "medianPrice90Days" DECIMAL(10,2),
    "lowestPriceAllTime" DECIMAL(10,2),
    "highestPrice90Days" DECIMAL(10,2),
    "priceChangeAmount" DECIMAL(10,2),
    "priceChangePercentage" DOUBLE PRECISION,
    "numberOfObservedPrices" INTEGER NOT NULL DEFAULT 0,
    "numberOfComparedMerchants" INTEGER NOT NULL DEFAULT 0,
    "cheapestMerchantId" TEXT,
    "nextCheapestPrice" DECIMAL(10,2),
    "differenceToNextMerchant" DECIMAL(10,2),
    "firstSeenAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),
    "lastPriceChangeAt" TIMESTAMP(3),
    "dealDetectedAt" TIMESTAMP(3),
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confidenceLevel" "ConfidenceLevel" NOT NULL DEFAULT 'LOW',
    "analysisVersion" TEXT NOT NULL,
    "historyDays" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DealAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductMatchCandidate" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "candidateProductId" TEXT NOT NULL,
    "method" "MatchMethod" NOT NULL,
    "similarity" DOUBLE PRECISION NOT NULL,
    "status" "MatchCandidateStatus" NOT NULL DEFAULT 'OPEN',
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "ProductMatchCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DealAnalysis_productId_key" ON "DealAnalysis"("productId");

-- CreateIndex
CREATE INDEX "DealAnalysis_dealDetectedAt_idx" ON "DealAnalysis"("dealDetectedAt");

-- CreateIndex
CREATE INDEX "DealAnalysis_lastPriceChangeAt_idx" ON "DealAnalysis"("lastPriceChangeAt");

-- CreateIndex
CREATE INDEX "ProductMatchCandidate_status_idx" ON "ProductMatchCandidate"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ProductMatchCandidate_productId_candidateProductId_key" ON "ProductMatchCandidate"("productId", "candidateProductId");

-- CreateIndex
CREATE INDEX "Product_status_imageStatus_idx" ON "Product"("status", "imageStatus");

-- AddForeignKey
ALTER TABLE "DealAnalysis" ADD CONSTRAINT "DealAnalysis_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductMatchCandidate" ADD CONSTRAINT "ProductMatchCandidate_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductMatchCandidate" ADD CONSTRAINT "ProductMatchCandidate_candidateProductId_fkey" FOREIGN KEY ("candidateProductId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
