-- CreateEnum
CREATE TYPE "CompanyStatus" AS ENUM ('PENDING', 'APPROVED', 'ACTIVE', 'SUSPENDED', 'BANKRUPT', 'CLOSED');

-- CreateEnum
CREATE TYPE "TransferType" AS ENUM ('ISSUANCE_TO_TREASURY', 'TREASURY_TO_BROKER', 'BROKER_TO_USER', 'USER_TRADE', 'ADJUSTMENT');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "isBlocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("userId","roleId")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "Wallet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "availableBalance" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "lockedBalance" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "investedValue" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "fictitiousProfit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TreasuryAccount" (
    "id" TEXT NOT NULL,
    "balance" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TreasuryAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrokerAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "receivedTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "available" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BrokerAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "sector" TEXT NOT NULL,
    "founderId" TEXT NOT NULL,
    "status" "CompanyStatus" NOT NULL DEFAULT 'PENDING',
    "totalShares" INTEGER NOT NULL,
    "circulatingShares" INTEGER NOT NULL,
    "initialPrice" DECIMAL(18,2) NOT NULL,
    "currentPrice" DECIMAL(18,2) NOT NULL,
    "fictitiousMarketCap" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoinIssuance" (
    "id" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "previousValue" DECIMAL(18,2) NOT NULL,
    "newValue" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CoinIssuance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoinTransfer" (
    "id" TEXT NOT NULL,
    "type" "TransferType" NOT NULL,
    "senderId" TEXT,
    "receiverId" TEXT,
    "amount" DECIMAL(18,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "previousValue" DECIMAL(18,2) NOT NULL,
    "newValue" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CoinTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "previous" TEXT,
    "current" TEXT,
    "reason" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdminLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "Role_key_key" ON "Role"("key");
CREATE UNIQUE INDEX "Permission_key_key" ON "Permission"("key");
CREATE UNIQUE INDEX "Wallet_userId_key" ON "Wallet"("userId");
CREATE UNIQUE INDEX "BrokerAccount_userId_key" ON "BrokerAccount"("userId");
CREATE UNIQUE INDEX "Company_ticker_key" ON "Company"("ticker");

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Company" ADD CONSTRAINT "Company_founderId_fkey" FOREIGN KEY ("founderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CoinTransfer" ADD CONSTRAINT "CoinTransfer_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CoinTransfer" ADD CONSTRAINT "CoinTransfer_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AdminLog" ADD CONSTRAINT "AdminLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
