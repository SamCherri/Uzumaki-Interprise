CREATE TYPE "CompanyCapitalFlowType" AS ENUM ('OWNER_RPC_CONTRIBUTION', 'ADMIN_RPC_ADJUSTMENT', 'PROJECT_REVENUE_IN', 'PROJECT_REVENUE_OUT');
CREATE TYPE "CompanyCapitalFlowSource" AS ENUM ('OWNER_WALLET', 'ADMIN_ADJUSTMENT', 'MARKET_FEE', 'MANUAL_CORRECTION');
CREATE TABLE "CompanyCapitalFlowEntry" (
  "id" TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "type" "CompanyCapitalFlowType" NOT NULL,
  "source" "CompanyCapitalFlowSource" NOT NULL,
  "amountRpc" DECIMAL(18,2) NOT NULL,
  "previousWalletRpcBalance" DECIMAL(18,2) NOT NULL,
  "newWalletRpcBalance" DECIMAL(18,2) NOT NULL,
  "previousProjectBalance" DECIMAL(18,2) NOT NULL,
  "newProjectBalance" DECIMAL(18,2) NOT NULL,
  "reason" TEXT NOT NULL,
  "metadata" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE "CompanyCapitalFlowEntry" ADD CONSTRAINT "CompanyCapitalFlowEntry_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CompanyCapitalFlowEntry" ADD CONSTRAINT "CompanyCapitalFlowEntry_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "CompanyCapitalFlowEntry_companyId_idx" ON "CompanyCapitalFlowEntry"("companyId");
CREATE INDEX "CompanyCapitalFlowEntry_actorUserId_idx" ON "CompanyCapitalFlowEntry"("actorUserId");
CREATE INDEX "CompanyCapitalFlowEntry_type_idx" ON "CompanyCapitalFlowEntry"("type");
CREATE INDEX "CompanyCapitalFlowEntry_source_idx" ON "CompanyCapitalFlowEntry"("source");
CREATE INDEX "CompanyCapitalFlowEntry_createdAt_idx" ON "CompanyCapitalFlowEntry"("createdAt");
