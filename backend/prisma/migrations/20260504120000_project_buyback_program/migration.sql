-- CreateEnum
CREATE TYPE "ProjectBuybackStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELED', 'EXPIRED');

-- AlterEnum
ALTER TYPE "CompanyOperationType" ADD VALUE IF NOT EXISTS 'PROJECT_BUYBACK_EXECUTION';

CREATE TABLE "ProjectBuybackProgram" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  "status" "ProjectBuybackStatus" NOT NULL DEFAULT 'ACTIVE',
  "budgetRpc" DECIMAL(18,2) NOT NULL,
  "spentRpc" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "remainingRpc" DECIMAL(18,2) NOT NULL,
  "maxPricePerShare" DECIMAL(24,8) NOT NULL,
  "targetShares" INTEGER NOT NULL,
  "purchasedShares" INTEGER NOT NULL DEFAULT 0,
  "reason" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "canceledAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "ProjectBuybackProgram_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectBuybackExecution" (
  "id" TEXT NOT NULL,
  "programId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "sellerUserId" TEXT NOT NULL,
  "tradeId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "unitPrice" DECIMAL(24,8) NOT NULL,
  "grossAmountRpc" DECIMAL(18,2) NOT NULL,
  "feeAmountRpc" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "totalAmountRpc" DECIMAL(18,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectBuybackExecution_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectTokenReserve" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "shares" INTEGER NOT NULL DEFAULT 0,
  "totalCostRpc" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProjectTokenReserve_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectTokenReserveEntry" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "programId" TEXT NOT NULL,
  "executionId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "shares" INTEGER NOT NULL,
  "unitPrice" DECIMAL(24,8) NOT NULL,
  "totalCostRpc" DECIMAL(18,2) NOT NULL,
  "reason" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectTokenReserveEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProjectBuybackExecution_tradeId_key" ON "ProjectBuybackExecution"("tradeId");
CREATE UNIQUE INDEX "ProjectTokenReserve_companyId_key" ON "ProjectTokenReserve"("companyId");

ALTER TABLE "ProjectBuybackProgram" ADD CONSTRAINT "ProjectBuybackProgram_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProjectBuybackProgram" ADD CONSTRAINT "ProjectBuybackProgram_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProjectBuybackExecution" ADD CONSTRAINT "ProjectBuybackExecution_programId_fkey" FOREIGN KEY ("programId") REFERENCES "ProjectBuybackProgram"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProjectBuybackExecution" ADD CONSTRAINT "ProjectBuybackExecution_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProjectBuybackExecution" ADD CONSTRAINT "ProjectBuybackExecution_sellerUserId_fkey" FOREIGN KEY ("sellerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProjectBuybackExecution" ADD CONSTRAINT "ProjectBuybackExecution_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "Trade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProjectTokenReserve" ADD CONSTRAINT "ProjectTokenReserve_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProjectTokenReserveEntry" ADD CONSTRAINT "ProjectTokenReserveEntry_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProjectTokenReserveEntry" ADD CONSTRAINT "ProjectTokenReserveEntry_programId_fkey" FOREIGN KEY ("programId") REFERENCES "ProjectBuybackProgram"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProjectTokenReserveEntry" ADD CONSTRAINT "ProjectTokenReserveEntry_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "ProjectBuybackExecution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProjectTokenReserveEntry" ADD CONSTRAINT "ProjectTokenReserveEntry_companyId_reserve_fkey" FOREIGN KEY ("companyId") REFERENCES "ProjectTokenReserve"("companyId") ON DELETE RESTRICT ON UPDATE CASCADE;
