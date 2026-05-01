-- CreateTable
CREATE TABLE "SystemModeConfig" (
    "id" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'NORMAL',
    "testTitle" TEXT,
    "testDescription" TEXT,
    "testEnabledAt" TIMESTAMP(3),
    "testDisabledAt" TIMESTAMP(3),
    "testDisabledReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SystemModeConfig_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "TestModeWallet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fiatBalance" DECIMAL(18,2) NOT NULL DEFAULT 10000.00,
    "rpcBalance" DECIMAL(18,2) NOT NULL DEFAULT 0.00,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TestModeWallet_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TestModeWallet_userId_key" ON "TestModeWallet"("userId");
CREATE TABLE "TestModeMarketState" (
    "id" TEXT NOT NULL,
    "currentPrice" DECIMAL(24,8) NOT NULL DEFAULT 1.00000000,
    "fiatReserve" DECIMAL(18,2) NOT NULL DEFAULT 1000000.00,
    "rpcReserve" DECIMAL(18,2) NOT NULL DEFAULT 1000000.00,
    "totalFiatVolume" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "totalRpcVolume" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "totalBuys" INTEGER NOT NULL DEFAULT 0,
    "totalSells" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TestModeMarketState_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "TestModeTrade" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "fiatAmount" DECIMAL(18,2) NOT NULL,
    "rpcAmount" DECIMAL(18,2) NOT NULL,
    "unitPrice" DECIMAL(24,8) NOT NULL,
    "priceBefore" DECIMAL(24,8) NOT NULL,
    "priceAfter" DECIMAL(24,8) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TestModeTrade_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "TestModeReport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "userSnapshot" TEXT,
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TestModeReport_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "TestModeWallet" ADD CONSTRAINT "TestModeWallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TestModeTrade" ADD CONSTRAINT "TestModeTrade_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TestModeReport" ADD CONSTRAINT "TestModeReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
INSERT INTO "SystemModeConfig" ("id", "mode", "createdAt", "updatedAt") VALUES ('SYSTEM_MODE_MAIN', 'NORMAL', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
