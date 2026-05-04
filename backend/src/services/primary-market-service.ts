import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../lib/prisma.js';
import { distributeFee } from './fee-distribution-service.js';

const HUNDRED = new Decimal(100);

export async function buyInitialOffer(input: { companyId: string; buyerUserId: string; quantity: number; ip: string; userAgent: string | null }) {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.$queryRaw`SELECT id FROM "Company" WHERE id = ${input.companyId} FOR UPDATE`;
    await tx.$queryRaw`SELECT "companyId" FROM "CompanyInitialOffer" WHERE "companyId" = ${input.companyId} FOR UPDATE`;

    const company = await tx.company.findUnique({ where: { id: input.companyId } });
    if (!company || company.status !== 'ACTIVE') throw new Error('Mercado não está ativo para compra de lançamento inicial.');

    const offer = await tx.companyInitialOffer.findUnique({ where: { companyId: input.companyId } });
    if (!offer || offer.availableShares <= 0) throw new Error('Lançamento inicial indisponível.');

    if (!Number.isInteger(input.quantity) || input.quantity <= 0) throw new Error('Quantidade inválida para compra inicial.');
    if (input.quantity > offer.availableShares) throw new Error('Quantidade solicitada maior que tokens disponíveis no lançamento inicial.');

    const wallet = await tx.wallet.upsert({ where: { userId: input.buyerUserId }, update: {}, create: { userId: input.buyerUserId } });
    const quantity = new Decimal(input.quantity);
    const unitPriceBefore = new Decimal(company.currentPrice);
    const grossAmount = unitPriceBefore.mul(quantity).toDecimalPlaces(2);
    const feeAmount = grossAmount.mul(company.buyFeePercent).div(HUNDRED).toDecimalPlaces(2);
    const totalAmount = grossAmount.add(feeAmount).toDecimalPlaces(2);

    if (wallet.rpcAvailableBalance.lessThan(totalAmount)) throw new Error('Saldo RPC insuficiente para comprar no lançamento.');

    const priceIncrease = quantity.div(new Decimal(offer.totalShares)).mul(unitPriceBefore).toDecimalPlaces(8);
    const unitPriceAfter = unitPriceBefore.add(priceIncrease).toDecimalPlaces(8);

    const walletAfter = wallet.rpcAvailableBalance.sub(totalAmount).toDecimalPlaces(2);
    const availableSharesAfter = offer.availableShares - input.quantity;

    if (availableSharesAfter < 0) throw new Error('Compra inválida: oferta inicial insuficiente.');

    await tx.wallet.update({ where: { id: wallet.id }, data: { rpcAvailableBalance: walletAfter } });
    await tx.companyInitialOffer.update({ where: { companyId: input.companyId }, data: { availableShares: availableSharesAfter } });

    const currentHolding = await tx.companyHolding.findUnique({ where: { userId_companyId: { userId: input.buyerUserId, companyId: input.companyId } } });
    const newShares = (currentHolding?.shares ?? 0) + input.quantity;
    const prevCost = new Decimal(currentHolding?.shares ?? 0).mul(currentHolding?.averageBuyPrice ?? new Decimal(0));
    const newCost = prevCost.add(grossAmount);
    const averageBuyPrice = newCost.div(new Decimal(newShares)).toDecimalPlaces(8);

    await tx.companyHolding.upsert({
      where: { userId_companyId: { userId: input.buyerUserId, companyId: input.companyId } },
      update: { shares: newShares, averageBuyPrice, estimatedValue: new Decimal(newShares).mul(unitPriceAfter).toDecimalPlaces(8) },
      create: { userId: input.buyerUserId, companyId: input.companyId, shares: input.quantity, averageBuyPrice, estimatedValue: quantity.mul(unitPriceAfter).toDecimalPlaces(8) },
    });

    await tx.company.update({ where: { id: input.companyId }, data: { availableOfferShares: { decrement: input.quantity }, circulatingShares: { increment: input.quantity }, currentPrice: unitPriceAfter, fictitiousMarketCap: unitPriceAfter.mul(company.totalShares).toDecimalPlaces(8) } });

    await tx.transaction.create({ data: { walletId: wallet.id, type: 'COMPANY_INITIAL_OFFER_BUY', amount: totalAmount, description: `Compra de ${input.quantity} tokens no lançamento inicial de ${company.ticker}` } });

    const operation = await tx.companyOperation.create({ data: { companyId: company.id, userId: input.buyerUserId, type: 'INITIAL_OFFER_BUY', quantity: input.quantity, unitPrice: unitPriceBefore, grossAmount, feeAmount, totalAmount, description: `Compra no lançamento inicial (${company.ticker}) com curva auditável de preço.` } });

    await distributeFee(tx, { companyId: company.id, operationId: operation.id, payerUserId: input.buyerUserId, sourceType: 'INITIAL_OFFER_BUY', totalFeeAmount: feeAmount });

    await tx.adminLog.create({ data: { userId: input.buyerUserId, action: 'COMPANY_INITIAL_OFFER_BUY', entity: 'CompanyOperation', reason: `Compra de ${input.quantity} tokens (${company.ticker})`, previous: JSON.stringify({ wallet: wallet.rpcAvailableBalance.toString(), availableOfferShares: offer.availableShares }), current: JSON.stringify({ wallet: walletAfter.toString(), availableOfferShares: availableSharesAfter, priceBefore: unitPriceBefore.toString(), priceAfter: unitPriceAfter.toString(), totalAmount: totalAmount.toString() }), ip: input.ip, userAgent: input.userAgent } });

    return { companyId: company.id, ticker: company.ticker, quantity: input.quantity, unitPriceBefore, unitPriceAfter, priceIncrease, grossAmount, feeAmount, totalAmount, availableSharesBefore: offer.availableShares, availableSharesAfter, buyerRpcBalanceBefore: wallet.rpcAvailableBalance, buyerRpcBalanceAfter: walletAfter, holdingSharesAfter: newShares };
  });
}
