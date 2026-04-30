-- Add dual-currency wallet balances (R$ + RPC)
ALTER TABLE "Wallet"
  ADD COLUMN "fiatAvailableBalance" DECIMAL(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN "fiatLockedBalance" DECIMAL(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN "fiatPendingWithdrawalBalance" DECIMAL(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN "rpcAvailableBalance" DECIMAL(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN "rpcLockedBalance" DECIMAL(18,2) NOT NULL DEFAULT 0;

-- Backfill legacy balances into RPC balances to preserve previous behavior
UPDATE "Wallet"
SET
  "rpcAvailableBalance" = "availableBalance",
  "rpcLockedBalance" = "lockedBalance"
WHERE
  "rpcAvailableBalance" = 0
  AND "rpcLockedBalance" = 0;

-- Conservative backfill for pending withdrawals into fiat pending withdrawal
UPDATE "Wallet"
SET "fiatPendingWithdrawalBalance" = "pendingWithdrawalBalance"
WHERE
  "pendingWithdrawalBalance" > 0
  AND "fiatPendingWithdrawalBalance" = 0;
