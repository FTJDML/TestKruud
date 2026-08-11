-- CreateEnum
CREATE TYPE "EditorialPageType" AS ENUM ('COMPARISON', 'BEST_OF', 'BUDGET_GUIDE', 'USE_CASE_GUIDE', 'GIFT_GUIDE', 'DESIGN_COLLECTION', 'DEAL_COLLECTION', 'PROBLEM_SOLUTION', 'DISCOVERY_COLLECTION');

-- CreateEnum
CREATE TYPE "SearchIntent" AS ENUM ('INFORMATIONAL', 'COMMERCIAL_INVESTIGATION', 'TRANSACTIONAL', 'INSPIRATIONAL');

-- CreateEnum
CREATE TYPE "PublicationStatus" AS ENUM ('DRAFT', 'NEEDS_REVIEW', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "EditorialProductRole" AS ENUM ('SELECTED', 'ALTERNATIVE');

-- CreateEnum
CREATE TYPE "CriterionValueType" AS ENUM ('TEXT', 'NUMBER', 'BOOLEAN', 'ENUM');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('UNVERIFIED', 'VERIFIED', 'NOT_PROVIDED');

-- CreateEnum
CREATE TYPE "EvidenceSourceType" AS ENUM ('MANUFACTURER_DOCUMENTATION', 'MERCHANT_FEED', 'AFFILIATE_API', 'MANUAL_PRICE_CHECK', 'OWN_PRICE_HISTORY', 'OWN_HANDS_ON_TEST', 'LICENSED_SOURCE', 'OTHER_VERIFIED_SOURCE');

-- CreateEnum
CREATE TYPE "InternalLinkTargetType" AS ENUM ('CLUSTER', 'CATEGORY', 'COLLECTION', 'EDITORIAL_PAGE', 'PRODUCT');

-- CreateEnum
CREATE TYPE "InternalLinkStatus" AS ENUM ('SUGGESTED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ContentPlanEntryType" AS ENUM ('PRODUCT', 'EDITORIAL_PAGE');

-- CreateEnum
CREATE TYPE "ContentPlanStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'DONE', 'CANCELLED');

-- CreateTable
CREATE TABLE "ContentCluster" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "introduction" TEXT NOT NULL,
    "heroImage" TEXT,
    "visible" BOOLEAN NOT NULL DEFAULT false,
    "minProducts" INTEGER NOT NULL DEFAULT 15,
    "minEditorialPages" INTEGER NOT NULL DEFAULT 2,
    "primaryTopics" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "categorySlugs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "seoTitle" TEXT NOT NULL,
    "metaDescription" TEXT NOT NULL,
    "status" "PublicationStatus" NOT NULL DEFAULT 'DRAFT',
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentCluster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EditorialPage" (
    "id" TEXT NOT NULL,
    "type" "EditorialPageType" NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "clusterId" TEXT,
    "primaryQuery" TEXT NOT NULL,
    "searchIntent" "SearchIntent" NOT NULL DEFAULT 'COMMERCIAL_INVESTIGATION',
    "audience" TEXT,
    "useCase" TEXT,
    "budgetMinCents" INTEGER,
    "budgetMaxCents" INTEGER,
    "introduction" TEXT NOT NULL,
    "methodology" TEXT,
    "selectionCriteria" TEXT,
    "conclusion" TEXT,
    "frequentlyAskedQuestions" JSONB NOT NULL DEFAULT '[]',
    "featuredProductId" TEXT,
    "featuredReason" TEXT,
    "featuredCaveat" TEXT,
    "featuredAlternativeNote" TEXT,
    "featuredLabel" TEXT,
    "status" "PublicationStatus" NOT NULL DEFAULT 'DRAFT',
    "scheduledPublishAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "lastFactCheckedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "reviewerNotes" TEXT,
    "indexable" BOOLEAN NOT NULL DEFAULT false,
    "indexabilityReasons" JSONB NOT NULL DEFAULT '[]',
    "seoTitle" TEXT NOT NULL,
    "metaDescription" TEXT NOT NULL,
    "canonicalUrl" TEXT,
    "heroImage" TEXT,
    "contentFactsHash" TEXT,
    "generationProvider" TEXT,
    "generationModel" TEXT,
    "generationWarnings" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EditorialPage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EditorialPageProduct" (
    "id" TEXT NOT NULL,
    "editorialPageId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "role" "EditorialProductRole" NOT NULL DEFAULT 'SELECTED',
    "position" INTEGER NOT NULL DEFAULT 0,
    "bestForAudience" TEXT,
    "recommendation" TEXT,
    "caveat" TEXT,
    "label" TEXT,
    "exceedsBudget" BOOLEAN NOT NULL DEFAULT false,
    "budgetNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EditorialPageProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComparisonCriterion" (
    "name" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "valueType" "CriterionValueType" NOT NULL DEFAULT 'TEXT',
    "unit" TEXT,
    "sourceRequired" BOOLEAN NOT NULL DEFAULT true,
    "higherIsBetter" BOOLEAN,
    "explanation" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComparisonCriterion_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "EditorialPageCriterion" (
    "id" TEXT NOT NULL,
    "editorialPageId" TEXT NOT NULL,
    "criterionName" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EditorialPageCriterion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductCriterionValue" (
    "id" TEXT NOT NULL,
    "editorialPageId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "criterionName" TEXT NOT NULL,
    "value" TEXT,
    "sourceId" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductCriterionValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceSource" (
    "id" TEXT NOT NULL,
    "sourceType" "EvidenceSourceType" NOT NULL,
    "title" TEXT NOT NULL,
    "publisher" TEXT,
    "url" TEXT,
    "accessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "factTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "usageAllowed" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvidenceSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EditorialPageSource" (
    "id" TEXT NOT NULL,
    "editorialPageId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EditorialPageSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InternalLinkSuggestion" (
    "id" TEXT NOT NULL,
    "fromType" "InternalLinkTargetType" NOT NULL,
    "fromRef" TEXT NOT NULL,
    "toType" "InternalLinkTargetType" NOT NULL,
    "toRef" TEXT NOT NULL,
    "anchorText" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "InternalLinkStatus" NOT NULL DEFAULT 'SUGGESTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "InternalLinkSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentPlanEntry" (
    "id" TEXT NOT NULL,
    "type" "ContentPlanEntryType" NOT NULL,
    "title" TEXT NOT NULL,
    "productId" TEXT,
    "editorialPageId" TEXT,
    "clusterId" TEXT,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "factCheckDueAt" TIMESTAMP(3),
    "priceCheckDueAt" TIMESTAMP(3),
    "season" TEXT,
    "homepagePlacement" TEXT,
    "updateReminderAt" TIMESTAMP(3),
    "republishOnPriceDrop" BOOLEAN NOT NULL DEFAULT false,
    "status" "ContentPlanStatus" NOT NULL DEFAULT 'PLANNED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentPlanEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ContentCluster_slug_key" ON "ContentCluster"("slug");

-- CreateIndex
CREATE INDEX "ContentCluster_status_visible_idx" ON "ContentCluster"("status", "visible");

-- CreateIndex
CREATE UNIQUE INDEX "EditorialPage_slug_key" ON "EditorialPage"("slug");

-- CreateIndex
CREATE INDEX "EditorialPage_status_indexable_idx" ON "EditorialPage"("status", "indexable");

-- CreateIndex
CREATE INDEX "EditorialPage_type_status_idx" ON "EditorialPage"("type", "status");

-- CreateIndex
CREATE INDEX "EditorialPage_clusterId_idx" ON "EditorialPage"("clusterId");

-- CreateIndex
CREATE INDEX "EditorialPage_scheduledPublishAt_idx" ON "EditorialPage"("scheduledPublishAt");

-- CreateIndex
CREATE INDEX "EditorialPageProduct_editorialPageId_role_position_idx" ON "EditorialPageProduct"("editorialPageId", "role", "position");

-- CreateIndex
CREATE UNIQUE INDEX "EditorialPageProduct_editorialPageId_productId_key" ON "EditorialPageProduct"("editorialPageId", "productId");

-- CreateIndex
CREATE INDEX "EditorialPageCriterion_editorialPageId_displayOrder_idx" ON "EditorialPageCriterion"("editorialPageId", "displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "EditorialPageCriterion_editorialPageId_criterionName_key" ON "EditorialPageCriterion"("editorialPageId", "criterionName");

-- CreateIndex
CREATE INDEX "ProductCriterionValue_editorialPageId_criterionName_idx" ON "ProductCriterionValue"("editorialPageId", "criterionName");

-- CreateIndex
CREATE UNIQUE INDEX "ProductCriterionValue_editorialPageId_productId_criterionNa_key" ON "ProductCriterionValue"("editorialPageId", "productId", "criterionName");

-- CreateIndex
CREATE INDEX "EvidenceSource_sourceType_idx" ON "EvidenceSource"("sourceType");

-- CreateIndex
CREATE UNIQUE INDEX "EditorialPageSource_editorialPageId_sourceId_key" ON "EditorialPageSource"("editorialPageId", "sourceId");

-- CreateIndex
CREATE INDEX "InternalLinkSuggestion_status_idx" ON "InternalLinkSuggestion"("status");

-- CreateIndex
CREATE INDEX "InternalLinkSuggestion_toType_toRef_status_idx" ON "InternalLinkSuggestion"("toType", "toRef", "status");

-- CreateIndex
CREATE UNIQUE INDEX "InternalLinkSuggestion_fromType_fromRef_toType_toRef_key" ON "InternalLinkSuggestion"("fromType", "fromRef", "toType", "toRef");

-- CreateIndex
CREATE INDEX "ContentPlanEntry_scheduledFor_status_idx" ON "ContentPlanEntry"("scheduledFor", "status");

-- CreateIndex
CREATE INDEX "ContentPlanEntry_type_status_idx" ON "ContentPlanEntry"("type", "status");

-- AddForeignKey
ALTER TABLE "EditorialPage" ADD CONSTRAINT "EditorialPage_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "ContentCluster"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EditorialPage" ADD CONSTRAINT "EditorialPage_featuredProductId_fkey" FOREIGN KEY ("featuredProductId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EditorialPageProduct" ADD CONSTRAINT "EditorialPageProduct_editorialPageId_fkey" FOREIGN KEY ("editorialPageId") REFERENCES "EditorialPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EditorialPageProduct" ADD CONSTRAINT "EditorialPageProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EditorialPageCriterion" ADD CONSTRAINT "EditorialPageCriterion_editorialPageId_fkey" FOREIGN KEY ("editorialPageId") REFERENCES "EditorialPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EditorialPageCriterion" ADD CONSTRAINT "EditorialPageCriterion_criterionName_fkey" FOREIGN KEY ("criterionName") REFERENCES "ComparisonCriterion"("name") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCriterionValue" ADD CONSTRAINT "ProductCriterionValue_editorialPageId_fkey" FOREIGN KEY ("editorialPageId") REFERENCES "EditorialPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCriterionValue" ADD CONSTRAINT "ProductCriterionValue_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCriterionValue" ADD CONSTRAINT "ProductCriterionValue_criterionName_fkey" FOREIGN KEY ("criterionName") REFERENCES "ComparisonCriterion"("name") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCriterionValue" ADD CONSTRAINT "ProductCriterionValue_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "EvidenceSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EditorialPageSource" ADD CONSTRAINT "EditorialPageSource_editorialPageId_fkey" FOREIGN KEY ("editorialPageId") REFERENCES "EditorialPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EditorialPageSource" ADD CONSTRAINT "EditorialPageSource_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "EvidenceSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentPlanEntry" ADD CONSTRAINT "ContentPlanEntry_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentPlanEntry" ADD CONSTRAINT "ContentPlanEntry_editorialPageId_fkey" FOREIGN KEY ("editorialPageId") REFERENCES "EditorialPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentPlanEntry" ADD CONSTRAINT "ContentPlanEntry_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "ContentCluster"("id") ON DELETE SET NULL ON UPDATE CASCADE;
