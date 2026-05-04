-- CreateEnum
CREATE TYPE "ProjectHolderDistributionStatus" AS ENUM ('DRAFT', 'READY', 'COMPLETED', 'CANCELED');
CREATE TYPE "ProjectHolderDistributionSnapshotStatus" AS ENUM ('PENDING', 'PAID', 'SKIPPED');

CREATE TABLE "ProjectHolderDistributionProgram" (
  "id" TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  "status" "ProjectHolderDistributionStatus" NOT NULL DEFAULT 'READY',
  "budgetRpc" DECIMAL(18,2) NOT NULL,
  "distributedRpc" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "refundedRpc" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "eligibleShares" INTEGER NOT NULL,
  "eligibleHoldersCount" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "excludeFounder" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "executedAt" TIMESTAMP(3),
  "canceledAt" TIMESTAMP(3),
  CONSTRAINT "ProjectHolderDistributionProgram_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ProjectHolderDistributionProgram_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "ProjectHolderDistributionSnapshot" (
  "id" TEXT PRIMARY KEY,
  "programId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "shares" INTEGER NOT NULL,
  "sharePercent" DECIMAL(24,8) NOT NULL,
  "calculatedAmountRpc" DECIMAL(18,2) NOT NULL,
  "paidAmountRpc" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "status" "ProjectHolderDistributionSnapshotStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "paidAt" TIMESTAMP(3),
  CONSTRAINT "ProjectHolderDistributionSnapshot_programId_fkey" FOREIGN KEY ("programId") REFERENCES "ProjectHolderDistributionProgram"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ProjectHolderDistributionSnapshot_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ProjectHolderDistributionSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "ProjectHolderDistributionPayment" (
  "id" TEXT PRIMARY KEY,
  "programId" TEXT NOT NULL,
  "snapshotId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "walletId" TEXT NOT NULL,
  "transactionId" TEXT NOT NULL UNIQUE,
  "amountRpc" DECIMAL(18,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectHolderDistributionPayment_programId_fkey" FOREIGN KEY ("programId") REFERENCES "ProjectHolderDistributionProgram"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ProjectHolderDistributionPayment_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "ProjectHolderDistributionSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ProjectHolderDistributionPayment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ProjectHolderDistributionPayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "ProjectHolderDistributionProgram_companyId_status_idx" ON "ProjectHolderDistributionProgram"("companyId", "status");
CREATE INDEX "ProjectHolderDistributionProgram_createdByUserId_idx" ON "ProjectHolderDistributionProgram"("createdByUserId");
CREATE INDEX "ProjectHolderDistributionSnapshot_programId_idx" ON "ProjectHolderDistributionSnapshot"("programId");
CREATE INDEX "ProjectHolderDistributionSnapshot_companyId_idx" ON "ProjectHolderDistributionSnapshot"("companyId");
CREATE INDEX "ProjectHolderDistributionSnapshot_userId_idx" ON "ProjectHolderDistributionSnapshot"("userId");
CREATE INDEX "ProjectHolderDistributionPayment_programId_idx" ON "ProjectHolderDistributionPayment"("programId");
CREATE INDEX "ProjectHolderDistributionPayment_snapshotId_idx" ON "ProjectHolderDistributionPayment"("snapshotId");
CREATE INDEX "ProjectHolderDistributionPayment_companyId_idx" ON "ProjectHolderDistributionPayment"("companyId");
CREATE INDEX "ProjectHolderDistributionPayment_userId_idx" ON "ProjectHolderDistributionPayment"("userId");
