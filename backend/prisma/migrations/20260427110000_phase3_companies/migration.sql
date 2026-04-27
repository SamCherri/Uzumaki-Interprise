-- AlterEnum
ALTER TYPE "CompanyStatus" ADD VALUE IF NOT EXISTS 'REJECTED';

-- CreateEnum
CREATE TYPE "CompanyOperationType" AS ENUM ('INITIAL_OFFER_BUY', 'ADMIN_APPROVE', 'ADMIN_REJECT', 'ADMIN_SUSPEND');

-- CreateEnum
CREATE TYPE "MarketOrderType" AS ENUM ('BUY', 'SELL');

-- CreateEnum
CREATE TYPE "MarketOrderMode" AS ENUM ('LIMIT', 'MARKET');

-- CreateEnum
CREATE TYPE "MarketOrderStatus" AS ENUM ('OPEN', 'PARTIALLY_FILLED', 'FILLED', 'CANCELED', 'REJECTED');

-- AlterTable Company
ALTER TABLE "Company" RENAME COLUMN "founderId" TO "founderUserId";
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "ownerSharePercent" DECIMAL(5,2) NOT NULL DEFAULT 0;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "publicOfferPercent" DECIMAL(5,2) NOT NULL DEFAULT 0;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "ownerShares" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "publicOfferShares" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "availableOfferShares" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "buyFeePercent" DECIMAL(5,2) NOT NULL DEFAULT 0;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "sellFeePercent" DECIMAL(5,2) NOT NULL DEFAULT 0;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "rejectedAt" TIMESTAMP(3);
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "suspendedAt" TIMESTAMP(3);
ALTER TABLE "Company" ALTER COLUMN "circulatingShares" SET DEFAULT 0;

-- CreateTable
CREATE TABLE "CompanyHolding" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "shares" INTEGER NOT NULL DEFAULT 0,
  "averageBuyPrice" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "estimatedValue" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CompanyHolding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyInitialOffer" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "totalShares" INTEGER NOT NULL,
  "availableShares" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CompanyInitialOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyOperation" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "userId" TEXT,
  "type" "CompanyOperationType" NOT NULL,
  "quantity" INTEGER,
  "unitPrice" DECIMAL(18,2),
  "grossAmount" DECIMAL(18,2),
  "feeAmount" DECIMAL(18,2),
  "totalAmount" DECIMAL(18,2),
  "description" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CompanyOperation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketOrder" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" "MarketOrderType" NOT NULL,
  "mode" "MarketOrderMode" NOT NULL,
  "quantity" INTEGER NOT NULL,
  "limitPrice" DECIMAL(18,2),
  "slippagePercent" DECIMAL(5,2),
  "status" "MarketOrderStatus" NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "executedAt" TIMESTAMP(3),
  CONSTRAINT "MarketOrder_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "CompanyHolding_userId_companyId_key" ON "CompanyHolding"("userId", "companyId");
CREATE UNIQUE INDEX "CompanyInitialOffer_companyId_key" ON "CompanyInitialOffer"("companyId");

-- Foreign keys
ALTER TABLE "Company" DROP CONSTRAINT IF EXISTS "Company_founderId_fkey";
ALTER TABLE "Company" ADD CONSTRAINT "Company_founderUserId_fkey" FOREIGN KEY ("founderUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CompanyHolding" ADD CONSTRAINT "CompanyHolding_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CompanyHolding" ADD CONSTRAINT "CompanyHolding_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CompanyInitialOffer" ADD CONSTRAINT "CompanyInitialOffer_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CompanyOperation" ADD CONSTRAINT "CompanyOperation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CompanyOperation" ADD CONSTRAINT "CompanyOperation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MarketOrder" ADD CONSTRAINT "MarketOrder_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketOrder" ADD CONSTRAINT "MarketOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
