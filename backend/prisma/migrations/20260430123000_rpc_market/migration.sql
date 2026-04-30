-- CreateEnum
CREATE TYPE "RpcExchangeSide" AS ENUM ('BUY_RPC', 'SELL_RPC');

-- CreateTable
CREATE TABLE "RpcMarketState" (
    "id" TEXT NOT NULL,
    "currentPrice" DECIMAL(24,8) NOT NULL DEFAULT 1,
    "fiatReserve" DECIMAL(18,2) NOT NULL DEFAULT 1000000,
    "rpcReserve" DECIMAL(18,2) NOT NULL DEFAULT 1000000,
    "totalFiatVolume" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "totalRpcVolume" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "totalBuys" INTEGER NOT NULL DEFAULT 0,
    "totalSells" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RpcMarketState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RpcExchangeTrade" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "side" "RpcExchangeSide" NOT NULL,
    "fiatAmount" DECIMAL(18,2) NOT NULL,
    "rpcAmount" DECIMAL(18,2) NOT NULL,
    "unitPrice" DECIMAL(24,8) NOT NULL,
    "priceBefore" DECIMAL(24,8) NOT NULL,
    "priceAfter" DECIMAL(24,8) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RpcExchangeTrade_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RpcExchangeTrade_userId_idx" ON "RpcExchangeTrade"("userId");

-- CreateIndex
CREATE INDEX "RpcExchangeTrade_createdAt_idx" ON "RpcExchangeTrade"("createdAt");

-- AddForeignKey
ALTER TABLE "RpcExchangeTrade" ADD CONSTRAINT "RpcExchangeTrade_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
