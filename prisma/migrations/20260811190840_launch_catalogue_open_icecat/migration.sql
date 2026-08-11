-- CreateEnum
CREATE TYPE "PriceCheckMethod" AS ENUM ('FEED', 'MANUAL');

-- AlterTable
ALTER TABLE "Offer" ADD COLUMN     "priceCheckMethod" "PriceCheckMethod" NOT NULL DEFAULT 'FEED';

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "dataSource" TEXT,
ADD COLUMN     "dataSourceRef" TEXT,
ADD COLUMN     "imageAttribution" TEXT,
ADD COLUMN     "imageUsageBasis" TEXT,
ADD COLUMN     "manufacturerName" TEXT,
ADD COLUMN     "manufacturerUrl" TEXT;
