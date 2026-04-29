import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { COMPANY_FEE_SHARE_PERCENT, PLATFORM_FEE_SHARE_PERCENT } from '../constants/fee-rules.js';

type Tx = Prisma.TransactionClient;

type DistributeFeeInput = {
  companyId: string;
  tradeId?: string;
  operationId?: string;
  payerUserId?: string;
  sourceType: 'INITIAL_OFFER_BUY' | 'MARKET_TRADE_BUY_FEE' | 'MARKET_TRADE_SELL_FEE' | 'MARKET_TRADE_TOTAL_FEE';
  totalFeeAmount: Decimal;
};

const HUNDRED = new Decimal(100);
const ZERO = new Decimal(0);

export async function ensurePlatformAccount(tx: Tx) {
  const existing = await tx.platformAccount.findFirst();
  if (existing) return existing;

  return tx.platformAccount.create({ data: {} });
}

export async function ensureCompanyRevenueAccount(tx: Tx, companyId: string) {
  return tx.companyRevenueAccount.upsert({
    where: { companyId },
    update: {},
    create: { companyId },
  });
}

export async function distributeFee(tx: Tx, input: DistributeFeeInput) {
  if (input.totalFeeAmount.lessThanOrEqualTo(ZERO)) {
    return null;
  }

  const platformAccount = await ensurePlatformAccount(tx);
  const companyRevenueAccount = await ensureCompanyRevenueAccount(tx, input.companyId);

  const platformAmount = input.totalFeeAmount
    .mul(new Decimal(PLATFORM_FEE_SHARE_PERCENT))
    .div(HUNDRED)
    .toDecimalPlaces(2);

  const companyAmount = input.totalFeeAmount.sub(platformAmount).toDecimalPlaces(2);

  await tx.platformAccount.update({
    where: { id: platformAccount.id },
    data: {
      balance: platformAccount.balance.add(platformAmount),
      totalReceivedFees: platformAccount.totalReceivedFees.add(platformAmount),
    },
  });

  await tx.companyRevenueAccount.update({
    where: { id: companyRevenueAccount.id },
    data: {
      balance: companyRevenueAccount.balance.add(companyAmount),
      totalReceivedFees: companyRevenueAccount.totalReceivedFees.add(companyAmount),
    },
  });

  return tx.feeDistribution.create({
    data: {
      companyId: input.companyId,
      tradeId: input.tradeId,
      operationId: input.operationId,
      payerUserId: input.payerUserId,
      sourceType: input.sourceType,
      totalFeeAmount: input.totalFeeAmount,
      platformAmount,
      companyAmount,
      platformSharePercent: new Decimal(PLATFORM_FEE_SHARE_PERCENT),
      companySharePercent: new Decimal(COMPANY_FEE_SHARE_PERCENT),
    },
  });
}
