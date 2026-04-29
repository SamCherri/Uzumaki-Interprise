-- CreateEnum
CREATE TYPE "CompanyBoostSource" AS ENUM ('PERSONAL_WALLET', 'PROJECT_REVENUE', 'ADMIN_ADJUSTMENT');

-- AlterEnum
ALTER TYPE "CompanyOperationType" ADD VALUE IF NOT EXISTS 'PROJECT_BOOST';

-- AlterTable
ALTER TABLE "CompanyRevenueAccount" ADD COLUMN "totalUsedForBoost" DECIMAL(18,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "CompanyBoostAccount" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "rpcBalance" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "totalInjectedRpc" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "totalUsedRpc" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyBoostAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CompanyBoostInjection" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT,
    "source" "CompanyBoostSource" NOT NULL,
    "amountRpc" DECIMAL(18,2) NOT NULL,
    "priceBefore" DECIMAL(18,2) NOT NULL,
    "priceAfter" DECIMAL(18,2) NOT NULL,
    "marketCapBefore" DECIMAL(18,2) NOT NULL,
    "marketCapAfter" DECIMAL(18,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyBoostInjection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CompanyBoostAccount_companyId_key" ON "CompanyBoostAccount"("companyId");
CREATE INDEX "CompanyBoostInjection_companyId_idx" ON "CompanyBoostInjection"("companyId");
CREATE INDEX "CompanyBoostInjection_userId_idx" ON "CompanyBoostInjection"("userId");
CREATE INDEX "CompanyBoostInjection_source_idx" ON "CompanyBoostInjection"("source");
CREATE INDEX "CompanyBoostInjection_createdAt_idx" ON "CompanyBoostInjection"("createdAt");

ALTER TABLE "CompanyBoostAccount" ADD CONSTRAINT "CompanyBoostAccount_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CompanyBoostInjection" ADD CONSTRAINT "CompanyBoostInjection_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CompanyBoostInjection" ADD CONSTRAINT "CompanyBoostInjection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
