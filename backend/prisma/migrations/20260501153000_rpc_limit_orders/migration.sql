-- CreateEnum
CREATE TYPE "RpcLimitOrderStatus" AS ENUM ('OPEN', 'FILLED', 'CANCELED', 'REJECTED');

-- CreateTable
CREATE TABLE "RpcLimitOrder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "side" "RpcExchangeSide" NOT NULL,
    "status" "RpcLimitOrderStatus" NOT NULL DEFAULT 'OPEN',
    "fiatAmount" DECIMAL(18,2),
    "rpcAmount" DECIMAL(18,2),
    "limitPrice" DECIMAL(24,8) NOT NULL,
    "lockedFiatAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "lockedRpcAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "filledFiatAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "filledRpcAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "executedAt" TIMESTAMP(3),
    "canceledAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    CONSTRAINT "RpcLimitOrder_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "RpcLimitOrder" ADD CONSTRAINT "RpcLimitOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "RpcLimitOrder_userId_idx" ON "RpcLimitOrder"("userId");
CREATE INDEX "RpcLimitOrder_side_idx" ON "RpcLimitOrder"("side");
CREATE INDEX "RpcLimitOrder_status_idx" ON "RpcLimitOrder"("status");
CREATE INDEX "RpcLimitOrder_limitPrice_idx" ON "RpcLimitOrder"("limitPrice");
CREATE INDEX "RpcLimitOrder_createdAt_idx" ON "RpcLimitOrder"("createdAt");
