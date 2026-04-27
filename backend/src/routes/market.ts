import { MarketOrder, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';

type AuthRequest = FastifyRequest & { user: { sub: string; roles?: string[] } };

type Tx = Prisma.TransactionClient;

const createOrderSchema = z.object({
  companyId: z.string().min(1),
  type: z.enum(['BUY', 'SELL']),
  mode: z.literal('LIMIT'),
  quantity: z.coerce.number().int().positive(),
  limitPrice: z.coerce.number().positive(),
});

const marketOrderSchema = z.object({
  quantity: z.coerce.number().int().positive(),
  slippagePercent: z.coerce.number().min(0).max(100),
});

const cancelOrderParams = z.object({ id: z.string().min(1) });
const companyParams = z.object({ companyId: z.string().min(1) });

const ZERO = new Decimal(0);

function toDecimal(value: number | string | Decimal) {
  return value instanceof Decimal ? value : new Decimal(value);
}

function statusFromRemaining(order: Pick<MarketOrder, 'quantity' | 'remainingQuantity'>) {
  if (order.remainingQuantity <= 0) return 'FILLED' as const;
  if (order.remainingQuantity < order.quantity) return 'PARTIALLY_FILLED' as const;
  return 'OPEN' as const;
}

async function getCompanyOrThrow(tx: Tx, companyId: string) {
  const company = await tx.company.findUnique({ where: { id: companyId } });
  if (!company) throw new Error('Empresa inexistente.');
  if (company.status !== 'ACTIVE') throw new Error('Empresa suspensa ou indisponível para negociação.');
  return company;
}

async function ensureWallet(tx: Tx, userId: string) {
  return tx.wallet.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });
}

async function getHolding(tx: Tx, userId: string, companyId: string) {
  return tx.companyHolding.findUnique({ where: { userId_companyId: { userId, companyId } } });
}

async function addSharesToBuyer(
  tx: Tx,
  input: { userId: string; companyId: string; quantity: number; tradeGrossAmount: Decimal; currentPrice: Decimal },
) {
  const currentHolding = await getHolding(tx, input.userId, input.companyId);
  const newShares = (currentHolding?.shares ?? 0) + input.quantity;
  const previousCost = toDecimal(currentHolding?.shares ?? 0).mul(currentHolding?.averageBuyPrice ?? ZERO);
  const newCost = previousCost.add(input.tradeGrossAmount);
  const nextAveragePrice = newShares > 0 ? newCost.div(new Decimal(newShares)) : ZERO;

  await tx.companyHolding.upsert({
    where: { userId_companyId: { userId: input.userId, companyId: input.companyId } },
    update: {
      shares: newShares,
      averageBuyPrice: nextAveragePrice,
      estimatedValue: new Decimal(newShares).mul(input.currentPrice),
    },
    create: {
      userId: input.userId,
      companyId: input.companyId,
      shares: input.quantity,
      averageBuyPrice: nextAveragePrice,
      estimatedValue: new Decimal(input.quantity).mul(input.currentPrice),
    },
  });
}

async function subtractSharesFromSeller(tx: Tx, input: { userId: string; companyId: string; quantity: number; currentPrice: Decimal }) {
  const holding = await getHolding(tx, input.userId, input.companyId);
  if (!holding || holding.shares < input.quantity) {
    throw new Error('Usuário vendedor não possui cotas suficientes.');
  }

  const nextShares = holding.shares - input.quantity;
  await tx.companyHolding.update({
    where: { id: holding.id },
    data: {
      shares: nextShares,
      estimatedValue: new Decimal(nextShares).mul(input.currentPrice),
    },
  });
}

async function runMatching(tx: Tx, takerOrderId: string, meta: { ip?: string; userAgent?: string }) {
  const taker = await tx.marketOrder.findUnique({ where: { id: takerOrderId } });
  if (!taker) throw new Error('Ordem não encontrada para matching.');

  const company = await getCompanyOrThrow(tx, taker.companyId);

  const takerWallet = await ensureWallet(tx, taker.userId);

  const initialOppositeOrders = await tx.marketOrder.findMany({
    where: {
      companyId: taker.companyId,
      type: taker.type === 'BUY' ? 'SELL' : 'BUY',
      mode: 'LIMIT',
      status: { in: ['OPEN', 'PARTIALLY_FILLED'] },
      remainingQuantity: { gt: 0 },
      ...(taker.type === 'BUY' && taker.mode === 'LIMIT' ? { limitPrice: { lte: taker.limitPrice! } } : {}),
      ...(taker.type === 'SELL' && taker.mode === 'LIMIT' ? { limitPrice: { gte: taker.limitPrice! } } : {}),
    },
    orderBy:
      taker.type === 'BUY'
        ? [{ limitPrice: 'asc' }, { createdAt: 'asc' }]
        : [{ limitPrice: 'desc' }, { createdAt: 'asc' }],
  });

  if (initialOppositeOrders.length === 0 && taker.mode === 'MARKET') {
    throw new Error('Livro sem liquidez para executar ordem a mercado.');
  }

  const bestPrice = initialOppositeOrders[0]?.limitPrice ?? null;

  let maxBuyPrice: Decimal | null = null;
  let minSellPrice: Decimal | null = null;

  if (taker.mode === 'MARKET' && bestPrice && taker.slippagePercent) {
    const factor = toDecimal(taker.slippagePercent).div(100);
    if (taker.type === 'BUY') {
      maxBuyPrice = bestPrice.mul(new Decimal(1).add(factor));
    } else {
      minSellPrice = bestPrice.mul(new Decimal(1).sub(factor));
    }
  }

  for (const restingOrder of initialOppositeOrders) {
    if (taker.remainingQuantity <= 0) break;

    const maker = await tx.marketOrder.findUnique({ where: { id: restingOrder.id } });
    if (!maker || maker.remainingQuantity <= 0) continue;

    const unitPrice = maker.limitPrice;
    if (!unitPrice) continue;

    if (maxBuyPrice && unitPrice.greaterThan(maxBuyPrice)) {
      if (taker.remainingQuantity === taker.quantity) {
        throw new Error('Slippage excedido para compra a mercado.');
      }
      break;
    }

    if (minSellPrice && unitPrice.lessThan(minSellPrice)) {
      if (taker.remainingQuantity === taker.quantity) {
        throw new Error('Slippage excedido para venda a mercado.');
      }
      break;
    }

    const tradeQuantity = Math.min(taker.remainingQuantity, maker.remainingQuantity);
    const quantityDecimal = new Decimal(tradeQuantity);
    const grossAmount = unitPrice.mul(quantityDecimal);
    const buyFeeAmount = grossAmount.mul(company.buyFeePercent).div(100);
    const sellFeeAmount = grossAmount.mul(company.sellFeePercent).div(100);
    const buyerTotalPay = grossAmount.add(buyFeeAmount);
    const sellerNetReceive = grossAmount.sub(sellFeeAmount);

    const buyerId = taker.type === 'BUY' ? taker.userId : maker.userId;
    const sellerId = taker.type === 'SELL' ? taker.userId : maker.userId;

    const buyerWallet = buyerId === taker.userId ? takerWallet : await ensureWallet(tx, buyerId);
    const sellerWallet = sellerId === taker.userId ? takerWallet : await ensureWallet(tx, sellerId);

    const buyerIsTaker = taker.type === 'BUY';
    const sellerIsTaker = taker.type === 'SELL';

    if (buyerIsTaker) {
      if (taker.mode === 'LIMIT') {
        if (buyerWallet.lockedBalance.lessThan(buyerTotalPay)) {
          throw new Error('Saldo bloqueado insuficiente para concluir a ordem de compra.');
        }
        await tx.wallet.update({
          where: { id: buyerWallet.id },
          data: { lockedBalance: buyerWallet.lockedBalance.sub(buyerTotalPay) },
        });
      } else {
        if (buyerWallet.availableBalance.lessThan(buyerTotalPay)) {
          if (taker.remainingQuantity === taker.quantity) throw new Error('Saldo insuficiente para compra a mercado.');
          break;
        }
        await tx.wallet.update({
          where: { id: buyerWallet.id },
          data: { availableBalance: buyerWallet.availableBalance.sub(buyerTotalPay) },
        });
      }
    } else {
      if (maker.lockedCash.lessThan(buyerTotalPay)) {
        throw new Error('Saldo bloqueado do comprador em ordem limite está inconsistente.');
      }
      await tx.wallet.update({
        where: { id: buyerWallet.id },
        data: { lockedBalance: buyerWallet.lockedBalance.sub(buyerTotalPay) },
      });
    }

    if (sellerIsTaker) {
      await subtractSharesFromSeller(tx, {
        userId: sellerId,
        companyId: company.id,
        quantity: tradeQuantity,
        currentPrice: company.currentPrice,
      });
    } else {
      if (maker.lockedShares < tradeQuantity) {
        throw new Error('Cotas bloqueadas da ordem limite estão inconsistentes.');
      }
    }

    await tx.wallet.update({
      where: { id: sellerWallet.id },
      data: { availableBalance: sellerWallet.availableBalance.add(sellerNetReceive) },
    });

    await addSharesToBuyer(tx, {
      userId: buyerId,
      companyId: company.id,
      quantity: tradeQuantity,
      tradeGrossAmount: grossAmount,
      currentPrice: unitPrice,
    });

    const takerRemaining = taker.remainingQuantity - tradeQuantity;
    const makerRemaining = maker.remainingQuantity - tradeQuantity;

    const takerOrderUpdateData: Prisma.MarketOrderUpdateInput = {
      remainingQuantity: takerRemaining,
      status: statusFromRemaining({ quantity: taker.quantity, remainingQuantity: takerRemaining }),
      executedAt: takerRemaining === 0 ? new Date() : null,
      lockedCash: taker.type === 'BUY' && taker.mode === 'LIMIT' ? taker.lockedCash.sub(buyerTotalPay) : taker.lockedCash,
      lockedShares: taker.type === 'SELL' && taker.mode === 'LIMIT' ? taker.lockedShares - tradeQuantity : taker.lockedShares,
    };

    const makerOrderUpdateData: Prisma.MarketOrderUpdateInput = {
      remainingQuantity: makerRemaining,
      status: statusFromRemaining({ quantity: maker.quantity, remainingQuantity: makerRemaining }),
      executedAt: makerRemaining === 0 ? new Date() : null,
      lockedCash: maker.type === 'BUY' ? maker.lockedCash.sub(buyerTotalPay) : maker.lockedCash,
      lockedShares: maker.type === 'SELL' ? maker.lockedShares - tradeQuantity : maker.lockedShares,
    };

    taker.remainingQuantity = takerRemaining;
    taker.lockedCash = toDecimal(takerOrderUpdateData.lockedCash as Decimal);
    taker.lockedShares = (takerOrderUpdateData.lockedShares as number) ?? taker.lockedShares;

    await tx.marketOrder.update({ where: { id: taker.id }, data: takerOrderUpdateData });
    await tx.marketOrder.update({ where: { id: maker.id }, data: makerOrderUpdateData });

    const trade = await tx.trade.create({
      data: {
        companyId: company.id,
        buyerId,
        sellerId,
        buyOrderId: taker.type === 'BUY' ? taker.id : maker.id,
        sellOrderId: taker.type === 'SELL' ? taker.id : maker.id,
        quantity: tradeQuantity,
        unitPrice,
        grossAmount,
        buyFeeAmount,
        sellFeeAmount,
      },
    });

    await tx.company.update({
      where: { id: company.id },
      data: {
        currentPrice: unitPrice,
        fictitiousMarketCap: unitPrice.mul(company.totalShares),
      },
    });

    await tx.transaction.create({
      data: {
        walletId: buyerWallet.id,
        type: 'MARKET_TRADE_BUY',
        amount: buyerTotalPay,
        description: `Compra de ${tradeQuantity} cota(s) de ${company.ticker} a ${unitPrice.toString()} por cota`,
      },
    });

    await tx.transaction.create({
      data: {
        walletId: sellerWallet.id,
        type: 'MARKET_TRADE_SELL',
        amount: sellerNetReceive,
        description: `Venda de ${tradeQuantity} cota(s) de ${company.ticker} a ${unitPrice.toString()} por cota`,
      },
    });

    await tx.companyOperation.create({
      data: {
        companyId: company.id,
        userId: taker.userId,
        type: 'MARKET_TRADE_EXECUTED',
        quantity: tradeQuantity,
        unitPrice,
        grossAmount,
        feeAmount: buyFeeAmount.add(sellFeeAmount),
        totalAmount: buyerTotalPay,
        description: `Trade executado entre comprador ${buyerId} e vendedor ${sellerId}.`,
      },
    });

    await tx.adminLog.create({
      data: {
        userId: taker.userId,
        action: 'MARKET_TRADE_EXECUTED',
        entity: 'Trade',
        reason: `Trade executado para ${company.ticker}`,
        current: JSON.stringify({ tradeId: trade.id, companyId: company.id, quantity: tradeQuantity, unitPrice: unitPrice.toString() }),
        ip: meta.ip,
        userAgent: meta.userAgent,
      },
    });
  }

  if (taker.mode === 'MARKET') {
    const finalStatus = taker.remainingQuantity === 0 ? 'FILLED' : taker.remainingQuantity < taker.quantity ? 'PARTIALLY_FILLED' : 'REJECTED';
    await tx.marketOrder.update({
      where: { id: taker.id },
      data: {
        status: finalStatus,
        executedAt: new Date(),
      },
    });
  }

  const refreshed = await tx.marketOrder.findUnique({ where: { id: taker.id } });
  if (refreshed && refreshed.mode === 'LIMIT' && refreshed.type === 'BUY' && refreshed.remainingQuantity === 0 && refreshed.lockedCash.greaterThan(0)) {
    const buyerWallet = await ensureWallet(tx, refreshed.userId);
    await tx.wallet.update({
      where: { id: buyerWallet.id },
      data: {
        lockedBalance: buyerWallet.lockedBalance.sub(refreshed.lockedCash),
        availableBalance: buyerWallet.availableBalance.add(refreshed.lockedCash),
      },
    });
    await tx.marketOrder.update({ where: { id: refreshed.id }, data: { lockedCash: ZERO } });
  }
}

export async function marketRoutes(app: FastifyInstance) {
  app.post('/market/orders', { preHandler: [app.authenticate] }, async (request, reply) => {
    const authRequest = request as AuthRequest;

    try {
      const body = createOrderSchema.parse(request.body);

      const order = await prisma.$transaction(async (tx) => {
        const company = await getCompanyOrThrow(tx, body.companyId);
        const wallet = await ensureWallet(tx, authRequest.user.sub);

        const limitPrice = new Decimal(body.limitPrice);
        const gross = limitPrice.mul(body.quantity);

        let lockedCash = ZERO;
        let lockedShares = 0;

        if (body.type === 'BUY') {
          const fee = gross.mul(company.buyFeePercent).div(100);
          lockedCash = gross.add(fee);

          if (wallet.availableBalance.lessThan(lockedCash)) {
            throw new Error('Saldo insuficiente para bloquear ordem limitada de compra.');
          }

          await tx.wallet.update({
            where: { id: wallet.id },
            data: {
              availableBalance: wallet.availableBalance.sub(lockedCash),
              lockedBalance: wallet.lockedBalance.add(lockedCash),
            },
          });
        }

        if (body.type === 'SELL') {
          const holding = await getHolding(tx, authRequest.user.sub, body.companyId);
          if (!holding || holding.shares < body.quantity) {
            throw new Error('Você não possui cotas suficientes para criar ordem de venda.');
          }

          lockedShares = body.quantity;
          await tx.companyHolding.update({
            where: { id: holding.id },
            data: {
              shares: holding.shares - body.quantity,
            },
          });
        }

        const created = await tx.marketOrder.create({
          data: {
            companyId: body.companyId,
            userId: authRequest.user.sub,
            type: body.type,
            mode: 'LIMIT',
            quantity: body.quantity,
            remainingQuantity: body.quantity,
            limitPrice,
            lockedCash,
            lockedShares,
            status: 'OPEN',
          },
        });

        await tx.companyOperation.create({
          data: {
            companyId: body.companyId,
            userId: authRequest.user.sub,
            type: 'MARKET_ORDER_CREATE',
            quantity: body.quantity,
            unitPrice: limitPrice,
            totalAmount: lockedCash,
            description: `Ordem limitada ${body.type} criada`,
          },
        });

        await tx.adminLog.create({
          data: {
            userId: authRequest.user.sub,
            action: 'MARKET_ORDER_CREATE',
            entity: 'MarketOrder',
            reason: `Ordem limitada ${body.type}`,
            current: JSON.stringify({ companyId: body.companyId, quantity: body.quantity, limitPrice: body.limitPrice, type: body.type }),
            ip: request.ip,
            userAgent: request.headers['user-agent'] ?? null,
          },
        });

        await runMatching(tx, created.id, { ip: request.ip, userAgent: request.headers['user-agent'] ?? undefined });
        return tx.marketOrder.findUnique({ where: { id: created.id } });
      });

      return reply.code(201).send({ order });
    } catch (error) {
      return reply.code(400).send({ message: (error as Error).message });
    }
  });

  app.get('/market/orders/me', { preHandler: [app.authenticate] }, async (request) => {
    const authRequest = request as AuthRequest;

    const orders = await prisma.marketOrder.findMany({
      where: { userId: authRequest.user.sub },
      include: {
        company: { select: { id: true, name: true, ticker: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    return { orders };
  });

  app.get('/market/companies/:companyId/order-book', { preHandler: [app.authenticate] }, async (request, reply) => {
    try {
      const { companyId } = companyParams.parse(request.params);
      await getCompanyOrThrow(prisma, companyId);

      const [buyOrders, sellOrders] = await Promise.all([
        prisma.marketOrder.findMany({
          where: { companyId, type: 'BUY', mode: 'LIMIT', status: { in: ['OPEN', 'PARTIALLY_FILLED'] }, remainingQuantity: { gt: 0 } },
          orderBy: [{ limitPrice: 'desc' }, { createdAt: 'asc' }],
        }),
        prisma.marketOrder.findMany({
          where: { companyId, type: 'SELL', mode: 'LIMIT', status: { in: ['OPEN', 'PARTIALLY_FILLED'] }, remainingQuantity: { gt: 0 } },
          orderBy: [{ limitPrice: 'asc' }, { createdAt: 'asc' }],
        }),
      ]);

      return { buyOrders, sellOrders };
    } catch (error) {
      return reply.code(400).send({ message: (error as Error).message });
    }
  });

  app.post('/market/orders/:id/cancel', { preHandler: [app.authenticate] }, async (request, reply) => {
    const authRequest = request as AuthRequest;

    try {
      const { id } = cancelOrderParams.parse(request.params);
      const canceled = await prisma.$transaction(async (tx) => {
        const order = await tx.marketOrder.findUnique({ where: { id } });
        if (!order) throw new Error('Ordem não encontrada.');
        if (order.userId !== authRequest.user.sub) throw new Error('Sem permissão para cancelar esta ordem.');
        if (!['OPEN', 'PARTIALLY_FILLED'].includes(order.status)) throw new Error('Somente ordens abertas podem ser canceladas.');

        if (order.type === 'BUY' && order.lockedCash.greaterThan(0)) {
          const wallet = await ensureWallet(tx, authRequest.user.sub);
          await tx.wallet.update({
            where: { id: wallet.id },
            data: {
              lockedBalance: wallet.lockedBalance.sub(order.lockedCash),
              availableBalance: wallet.availableBalance.add(order.lockedCash),
            },
          });
        }

        if (order.type === 'SELL' && order.lockedShares > 0) {
          const holding = await getHolding(tx, authRequest.user.sub, order.companyId);
          if (holding) {
            await tx.companyHolding.update({
              where: { id: holding.id },
              data: { shares: holding.shares + order.lockedShares },
            });
          } else {
            await tx.companyHolding.create({
              data: {
                userId: authRequest.user.sub,
                companyId: order.companyId,
                shares: order.lockedShares,
                averageBuyPrice: ZERO,
                estimatedValue: ZERO,
              },
            });
          }
        }

        const updated = await tx.marketOrder.update({
          where: { id: order.id },
          data: {
            status: 'CANCELED',
            canceledAt: new Date(),
            lockedCash: ZERO,
            lockedShares: 0,
          },
        });

        await tx.companyOperation.create({
          data: {
            companyId: order.companyId,
            userId: authRequest.user.sub,
            type: 'MARKET_ORDER_CANCEL',
            quantity: order.remainingQuantity,
            unitPrice: order.limitPrice,
            description: `Ordem ${order.id} cancelada`,
          },
        });

        await tx.adminLog.create({
          data: {
            userId: authRequest.user.sub,
            action: 'MARKET_ORDER_CANCEL',
            entity: 'MarketOrder',
            reason: `Cancelamento da ordem ${order.id}`,
            current: JSON.stringify({ orderId: order.id }),
            ip: request.ip,
            userAgent: request.headers['user-agent'] ?? null,
          },
        });

        return updated;
      });

      return { order: canceled };
    } catch (error) {
      return reply.code(400).send({ message: (error as Error).message });
    }
  });

  app.post('/market/companies/:companyId/buy-market', { preHandler: [app.authenticate] }, async (request, reply) => {
    const authRequest = request as AuthRequest;

    try {
      const { companyId } = companyParams.parse(request.params);
      const body = marketOrderSchema.parse(request.body);

      const result = await prisma.$transaction(async (tx) => {
        await getCompanyOrThrow(tx, companyId);

        const order = await tx.marketOrder.create({
          data: {
            companyId,
            userId: authRequest.user.sub,
            type: 'BUY',
            mode: 'MARKET',
            quantity: body.quantity,
            remainingQuantity: body.quantity,
            slippagePercent: body.slippagePercent,
            status: 'OPEN',
          },
        });

        await runMatching(tx, order.id, { ip: request.ip, userAgent: request.headers['user-agent'] ?? undefined });
        return tx.marketOrder.findUnique({ where: { id: order.id } });
      });

      return reply.code(201).send({ order: result });
    } catch (error) {
      return reply.code(400).send({ message: (error as Error).message });
    }
  });

  app.post('/market/companies/:companyId/sell-market', { preHandler: [app.authenticate] }, async (request, reply) => {
    const authRequest = request as AuthRequest;

    try {
      const { companyId } = companyParams.parse(request.params);
      const body = marketOrderSchema.parse(request.body);

      const result = await prisma.$transaction(async (tx) => {
        await getCompanyOrThrow(tx, companyId);

        const holding = await getHolding(tx, authRequest.user.sub, companyId);
        if (!holding || holding.shares < body.quantity) {
          throw new Error('Você não possui cotas suficientes para venda a mercado.');
        }

        const order = await tx.marketOrder.create({
          data: {
            companyId,
            userId: authRequest.user.sub,
            type: 'SELL',
            mode: 'MARKET',
            quantity: body.quantity,
            remainingQuantity: body.quantity,
            slippagePercent: body.slippagePercent,
            status: 'OPEN',
          },
        });

        await runMatching(tx, order.id, { ip: request.ip, userAgent: request.headers['user-agent'] ?? undefined });
        return tx.marketOrder.findUnique({ where: { id: order.id } });
      });

      return reply.code(201).send({ order: result });
    } catch (error) {
      return reply.code(400).send({ message: (error as Error).message });
    }
  });

  app.get('/market/companies/:companyId/trades', { preHandler: [app.authenticate] }, async (request, reply) => {
    try {
      const { companyId } = companyParams.parse(request.params);
      const trades = await prisma.trade.findMany({
        where: { companyId },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });

      return { trades };
    } catch (error) {
      return reply.code(400).send({ message: (error as Error).message });
    }
  });
}
