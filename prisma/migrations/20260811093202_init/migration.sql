-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('FIXTURE', 'CSV', 'JSON', 'XML', 'HTML', 'API');

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('CANDIDATE', 'DRAFT', 'NEEDS_REVIEW', 'PUBLISHED', 'REJECTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ReferencePriceType" AS ENUM ('MERCHANT_WAS_PRICE', 'RECOMMENDED_RETAIL_PRICE', 'OWN_PREVIOUS_PRICE', 'OWN_30_DAY_LOW', 'OWN_90_DAY_MEDIAN');

-- CreateEnum
CREATE TYPE "EditionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "EditionSection" AS ENUM ('HERO', 'TODAY', 'EDITORS_PICK', 'UNDER_100', 'UNNECESSARY_BUT_GREAT');

-- CreateEnum
CREATE TYPE "ScrapeRunStatus" AS ENUM ('RUNNING', 'SUCCESS', 'PARTIAL', 'FAILED');

-- CreateTable
CREATE TABLE "Merchant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "sourceType" "SourceType" NOT NULL DEFAULT 'FIXTURE',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "scrapingAllowed" BOOLEAN NOT NULL DEFAULT false,
    "feedUrl" TEXT,
    "trustScore" INTEGER NOT NULL DEFAULT 50,
    "configuration" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Merchant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "externalId" TEXT,
    "ean" TEXT,
    "brand" TEXT,
    "model" TEXT,
    "title" TEXT NOT NULL,
    "normalizedTitle" TEXT NOT NULL,
    "primaryCategory" TEXT NOT NULL,
    "shortSourceDescription" TEXT,
    "specifications" JSONB NOT NULL DEFAULT '{}',
    "imageUrl" TEXT NOT NULL,
    "imageAlt" TEXT NOT NULL,
    "status" "ProductStatus" NOT NULL DEFAULT 'CANDIDATE',
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "uniquenessScore" INTEGER NOT NULL DEFAULT 0,
    "usefulnessScore" INTEGER NOT NULL DEFAULT 0,
    "storyScore" INTEGER NOT NULL DEFAULT 0,
    "giftabilityScore" INTEGER NOT NULL DEFAULT 0,
    "visualQualityScore" INTEGER NOT NULL DEFAULT 60,
    "collections" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Offer" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "externalOfferId" TEXT,
    "currentPrice" DECIMAL(10,2) NOT NULL,
    "referencePrice" DECIMAL(10,2),
    "referencePriceType" "ReferencePriceType",
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "discountPercentage" INTEGER,
    "inStock" BOOLEAN NOT NULL DEFAULT true,
    "destinationUrl" TEXT NOT NULL,
    "affiliateUrl" TEXT,
    "promotionEndsAt" TIMESTAMP(3),
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "staleAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Offer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceSnapshot" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "referencePrice" DECIMAL(10,2),
    "inStock" BOOLEAN NOT NULL DEFAULT true,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EditorialContent" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "teaser" TEXT NOT NULL,
    "longDescription" TEXT NOT NULL,
    "whyItStandsOut" TEXT NOT NULL,
    "bestFor" JSONB NOT NULL DEFAULT '[]',
    "caveat" TEXT NOT NULL,
    "seoTitle" TEXT NOT NULL,
    "metaDescription" TEXT NOT NULL,
    "tags" JSONB NOT NULL DEFAULT '[]',
    "promptVersion" TEXT NOT NULL,
    "aiProvider" TEXT NOT NULL,
    "sourceFactsHash" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EditorialContent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyEdition" (
    "id" TEXT NOT NULL,
    "editionDate" DATE NOT NULL,
    "status" "EditionStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyEdition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyEditionItem" (
    "id" TEXT NOT NULL,
    "dailyEditionId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "section" "EditionSection" NOT NULL,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyEditionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnonymousSave" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "anonymousVisitorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnonymousSave_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboundClick" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "anonymousVisitorId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'unknown',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutboundClick_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScrapeRun" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "status" "ScrapeRunStatus" NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "productsFound" INTEGER NOT NULL DEFAULT 0,
    "productsCreated" INTEGER NOT NULL DEFAULT 0,
    "offersUpdated" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScrapeRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Merchant_slug_key" ON "Merchant"("slug");

-- CreateIndex
CREATE INDEX "Merchant_enabled_idx" ON "Merchant"("enabled");

-- CreateIndex
CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Product_ean_key" ON "Product"("ean");

-- CreateIndex
CREATE INDEX "Product_status_primaryCategory_idx" ON "Product"("status", "primaryCategory");

-- CreateIndex
CREATE INDEX "Product_normalizedTitle_idx" ON "Product"("normalizedTitle");

-- CreateIndex
CREATE INDEX "Product_createdAt_idx" ON "Product"("createdAt");

-- CreateIndex
CREATE INDEX "Offer_productId_idx" ON "Offer"("productId");

-- CreateIndex
CREATE INDEX "Offer_checkedAt_idx" ON "Offer"("checkedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Offer_merchantId_externalOfferId_key" ON "Offer"("merchantId", "externalOfferId");

-- CreateIndex
CREATE INDEX "PriceSnapshot_offerId_capturedAt_idx" ON "PriceSnapshot"("offerId", "capturedAt");

-- CreateIndex
CREATE UNIQUE INDEX "EditorialContent_productId_key" ON "EditorialContent"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyEdition_editionDate_key" ON "DailyEdition"("editionDate");

-- CreateIndex
CREATE INDEX "DailyEdition_status_editionDate_idx" ON "DailyEdition"("status", "editionDate");

-- CreateIndex
CREATE INDEX "DailyEditionItem_dailyEditionId_section_position_idx" ON "DailyEditionItem"("dailyEditionId", "section", "position");

-- CreateIndex
CREATE UNIQUE INDEX "DailyEditionItem_dailyEditionId_productId_key" ON "DailyEditionItem"("dailyEditionId", "productId");

-- CreateIndex
CREATE INDEX "AnonymousSave_anonymousVisitorId_idx" ON "AnonymousSave"("anonymousVisitorId");

-- CreateIndex
CREATE UNIQUE INDEX "AnonymousSave_productId_anonymousVisitorId_key" ON "AnonymousSave"("productId", "anonymousVisitorId");

-- CreateIndex
CREATE INDEX "OutboundClick_productId_createdAt_idx" ON "OutboundClick"("productId", "createdAt");

-- CreateIndex
CREATE INDEX "ScrapeRun_merchantId_startedAt_idx" ON "ScrapeRun"("merchantId", "startedAt");

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceSnapshot" ADD CONSTRAINT "PriceSnapshot_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EditorialContent" ADD CONSTRAINT "EditorialContent_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyEditionItem" ADD CONSTRAINT "DailyEditionItem_dailyEditionId_fkey" FOREIGN KEY ("dailyEditionId") REFERENCES "DailyEdition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyEditionItem" ADD CONSTRAINT "DailyEditionItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyEditionItem" ADD CONSTRAINT "DailyEditionItem_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnonymousSave" ADD CONSTRAINT "AnonymousSave_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboundClick" ADD CONSTRAINT "OutboundClick_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboundClick" ADD CONSTRAINT "OutboundClick_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboundClick" ADD CONSTRAINT "OutboundClick_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScrapeRun" ADD CONSTRAINT "ScrapeRun_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
