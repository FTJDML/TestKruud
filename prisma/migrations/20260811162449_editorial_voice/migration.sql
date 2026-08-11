-- CreateEnum
CREATE TYPE "OpeningStyle" AS ENUM ('PRICE_DROP', 'RECOGNIZABLE_PROBLEM', 'VISUAL_SURPRISE', 'USE_CASE_SCENE', 'GIFT_REACTION', 'DESIGN_OBSERVATION', 'PRACTICAL_DISCOVERY', 'DRY_HUMOR', 'DIRECT_FACT', 'EDITORIAL_QUESTION');

-- AlterTable
ALTER TABLE "EditorialContent" ADD COLUMN     "closingHash" TEXT,
ADD COLUMN     "humanEdited" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "humanReviewedAt" TIMESTAMP(3),
ADD COLUMN     "openingHash" TEXT,
ADD COLUMN     "openingStyle" "OpeningStyle",
ADD COLUMN     "reviewerNotes" TEXT,
ADD COLUMN     "styleVersion" TEXT,
ADD COLUMN     "styleWarnings" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "EditorialPage" ADD COLUMN     "closingHash" TEXT,
ADD COLUMN     "humanEdited" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "humanReviewedAt" TIMESTAMP(3),
ADD COLUMN     "openingHash" TEXT,
ADD COLUMN     "openingStyle" "OpeningStyle",
ADD COLUMN     "styleVersion" TEXT,
ADD COLUMN     "styleWarnings" JSONB NOT NULL DEFAULT '[]';

-- CreateIndex
CREATE INDEX "EditorialContent_humanReviewedAt_idx" ON "EditorialContent"("humanReviewedAt");

-- CreateIndex
CREATE INDEX "EditorialContent_generatedAt_idx" ON "EditorialContent"("generatedAt");
