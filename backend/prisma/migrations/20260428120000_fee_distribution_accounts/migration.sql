-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "FeeSourceType" AS ENUM ('INITIAL_OFFER_BUY', 'MARKET_TRADE_BUY_FEE', 'MARKET_TRADE_SELL_FEE', 'MARKET_TRADE_TOTAL_FEE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "PlatformAccount" (
  "id" TEXT NOT NULL,
  "balance" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "totalReceivedFees" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PlatformAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CompanyRevenueAccount" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "balance" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "totalReceivedFees" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "totalWithdrawn" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CompanyRevenueAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "FeeDistribution" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "tradeId" TEXT,
  "operationId" TEXT,
  "payerUserId" TEXT,
  "sourceType" "FeeSourceType" NOT NULL,
  "totalFeeAmount" DECIMAL(18,2) NOT NULL,
  "platformAmount" DECIMAL(18,2) NOT NULL,
  "companyAmount" DECIMAL(18,2) NOT NULL,
  "platformSharePercent" DECIMAL(5,2) NOT NULL,
  "companySharePercent" DECIMAL(5,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FeeDistribution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "CompanyRevenueAccount_companyId_key" ON "CompanyRevenueAccount"("companyId");
CREATE INDEX IF NOT EXISTS "FeeDistribution_companyId_createdAt_idx" ON "FeeDistribution"("companyId", "createdAt");
CREATE INDEX IF NOT EXISTS "FeeDistribution_tradeId_idx" ON "FeeDistribution"("tradeId");
CREATE INDEX IF NOT EXISTS "FeeDistribution_operationId_idx" ON "FeeDistribution"("operationId");
CREATE INDEX IF NOT EXISTS "FeeDistribution_payerUserId_idx" ON "FeeDistribution"("payerUserId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "CompanyRevenueAccount" ADD CONSTRAINT "CompanyRevenueAccount_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "FeeDistribution" ADD CONSTRAINT "FeeDistribution_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "FeeDistribution" ADD CONSTRAINT "FeeDistribution_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "Trade"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "FeeDistribution" ADD CONSTRAINT "FeeDistribution_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "CompanyOperation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "FeeDistribution" ADD CONSTRAINT "FeeDistribution_payerUserId_fkey" FOREIGN KEY ("payerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
