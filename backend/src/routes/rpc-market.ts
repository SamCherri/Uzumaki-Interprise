import { Decimal } from '@prisma/client/runtime/library';
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';

const MIN_AMOUNT = new Decimal('0.01');
const PRICE_SCALE = 8;
const RESERVE_SCALE = 2;

const amountSchema = z.object({
  fiatAmount: z.coerce.number().min(0.01).optional(),
  rpcAmount: z.coerce.number().min(0.01).optional(),
});

function toDecimal(value: string | number | Decimal) {
  return value instanceof Decimal ? value : new Decimal(value);
}

function ensurePositive(value: Decimal, message: string) {
  if (value.lte(0)) throw new Error(message);
}

async function ensureMarketState() {
  const existing = await prisma.rpcMarketState.findFirst();
  if (existing) return existing;

  return prisma.rpcMarketState.create({
    data: {
      currentPrice: new Decimal('1.00000000'),
      fiatReserve: new Decimal('1000000.00'),
      rpcReserve: new Decimal('1000000.00'),
    },
  });
}

export async function rpcMarketRoutes(app: FastifyInstance) {
  app.get('/rpc-market', async () => {
    const state = await ensureMarketState();
    return state;
  });

  app.get('/rpc-market/trades', async (request) => {
    const query = z.object({ limit: z.coerce.number().int().min(1).max(200).optional() }).parse(request.query ?? {});
    const trades = await prisma.rpcExchangeTrade.findMany({
      orderBy: { createdAt: 'desc' },
      take: query.limit ?? 50,
      select: { id: true, side: true, fiatAmount: true, rpcAmount: true, unitPrice: true, priceBefore: true, priceAfter: true, createdAt: true },
    });
    return { trades };
  });

  app.post('/rpc-market/buy', { preHandler: [app.authenticate] }, async (request, reply) => {
    const body = amountSchema.parse(request.body ?? {});
    if (body.fiatAmount == null) return reply.status(400).send({ message: 'fiatAmount é obrigatório.' });

    const fiatAmount = toDecimal(body.fiatAmount).toDecimalPlaces(2);
    if (fiatAmount.lt(MIN_AMOUNT)) return reply.status(400).send({ message: 'Valor mínimo para compra é R$ 0,01.' });

    try {
      const result = await prisma.$transaction(async (tx) => {
        const wallet = await tx.wallet.findUnique({ where: { userId: (request.user as { sub: string }).sub } });
        if (!wallet) throw new Error('Carteira não encontrada.');

        const state = await tx.rpcMarketState.findFirst() ?? await tx.rpcMarketState.create({ data: {} });
        const priceBefore = toDecimal(state.currentPrice);
        const k = toDecimal(state.fiatReserve).mul(state.rpcReserve);
        const newFiatReserve = toDecimal(state.fiatReserve).add(fiatAmount);
        const newRpcReserve = k.div(newFiatReserve).toDecimalPlaces(RESERVE_SCALE);
        ensurePositive(newRpcReserve, 'Liquidez RPC insuficiente para esta operação.');
        const rpcAmount = toDecimal(state.rpcReserve).sub(newRpcReserve).toDecimalPlaces(2);
        if (rpcAmount.lt(MIN_AMOUNT)) throw new Error('Operação muito pequena para execução.');

        const updatedWallet = await tx.wallet.updateMany({
          where: { id: wallet.id, fiatAvailableBalance: { gte: fiatAmount } },
          data: {
            fiatAvailableBalance: { decrement: fiatAmount },
            rpcAvailableBalance: { increment: rpcAmount },
          },
        });

        if (updatedWallet.count !== 1) throw new Error('Saldo insuficiente.');

        ensurePositive(newFiatReserve, 'Reserva fiat inválida.');
        const priceAfter = newFiatReserve.div(newRpcReserve).toDecimalPlaces(PRICE_SCALE);

        await tx.rpcMarketState.update({
          where: { id: state.id },
          data: {
            fiatReserve: newFiatReserve,
            rpcReserve: newRpcReserve,
            currentPrice: priceAfter,
            totalFiatVolume: { increment: fiatAmount },
            totalRpcVolume: { increment: rpcAmount },
            totalBuys: { increment: 1 },
          },
        });

        await tx.rpcExchangeTrade.create({
          data: {
            userId: (request.user as { sub: string }).sub,
            side: 'BUY_RPC',
            fiatAmount,
            rpcAmount,
            unitPrice: priceBefore,
            priceBefore,
            priceAfter,
          },
        });

        await tx.transaction.create({ data: { walletId: wallet.id, type: 'RPC_MARKET_BUY', amount: fiatAmount, description: 'Compra de RPC com R$' } });

        const latestWallet = await tx.wallet.findUniqueOrThrow({ where: { id: wallet.id } });
        return { fiatAmount, rpcAmount, priceBefore, priceAfter, wallet: latestWallet };
      });

      return {
        message: 'RPC comprado com sucesso.',
        fiatAmount: result.fiatAmount,
        rpcAmount: result.rpcAmount,
        priceBefore: result.priceBefore,
        priceAfter: result.priceAfter,
        wallet: {
          fiatAvailableBalance: result.wallet.fiatAvailableBalance,
          rpcAvailableBalance: result.wallet.rpcAvailableBalance,
        },
      };
    } catch (error) {
      return reply.status(400).send({ message: (error as Error).message });
    }
  });

  app.post('/rpc-market/sell', { preHandler: [app.authenticate] }, async (request, reply) => {
    const body = amountSchema.parse(request.body ?? {});
    if (body.rpcAmount == null) return reply.status(400).send({ message: 'rpcAmount é obrigatório.' });

    const rpcAmount = toDecimal(body.rpcAmount).toDecimalPlaces(2);
    if (rpcAmount.lt(MIN_AMOUNT)) return reply.status(400).send({ message: 'Valor mínimo para venda é 0,01 RPC.' });

    try {
      const result = await prisma.$transaction(async (tx) => {
        const wallet = await tx.wallet.findUnique({ where: { userId: (request.user as { sub: string }).sub } });
        if (!wallet) throw new Error('Carteira não encontrada.');

        const state = await tx.rpcMarketState.findFirst() ?? await tx.rpcMarketState.create({ data: {} });
        const priceBefore = toDecimal(state.currentPrice);
        const k = toDecimal(state.fiatReserve).mul(state.rpcReserve);
        const newRpcReserve = toDecimal(state.rpcReserve).add(rpcAmount);
        const newFiatReserve = k.div(newRpcReserve).toDecimalPlaces(RESERVE_SCALE);
        ensurePositive(newFiatReserve, 'Liquidez fiat insuficiente para esta operação.');
        const fiatAmount = toDecimal(state.fiatReserve).sub(newFiatReserve).toDecimalPlaces(2);
        if (fiatAmount.lt(MIN_AMOUNT)) throw new Error('Operação muito pequena para execução.');

        const updatedWallet = await tx.wallet.updateMany({
          where: { id: wallet.id, rpcAvailableBalance: { gte: rpcAmount } },
          data: {
            rpcAvailableBalance: { decrement: rpcAmount },
            fiatAvailableBalance: { increment: fiatAmount },
          },
        });

        if (updatedWallet.count !== 1) throw new Error('Saldo insuficiente.');

        const priceAfter = newFiatReserve.div(newRpcReserve).toDecimalPlaces(PRICE_SCALE);

        await tx.rpcMarketState.update({
          where: { id: state.id },
          data: {
            fiatReserve: newFiatReserve,
            rpcReserve: newRpcReserve,
            currentPrice: priceAfter,
            totalFiatVolume: { increment: fiatAmount },
            totalRpcVolume: { increment: rpcAmount },
            totalSells: { increment: 1 },
          },
        });

        await tx.rpcExchangeTrade.create({
          data: {
            userId: (request.user as { sub: string }).sub,
            side: 'SELL_RPC',
            fiatAmount,
            rpcAmount,
            unitPrice: priceBefore,
            priceBefore,
            priceAfter,
          },
        });

        await tx.transaction.create({ data: { walletId: wallet.id, type: 'RPC_MARKET_SELL', amount: fiatAmount, description: 'Venda de RPC por R$' } });

        const latestWallet = await tx.wallet.findUniqueOrThrow({ where: { id: wallet.id } });
        return { fiatAmount, rpcAmount, priceBefore, priceAfter, wallet: latestWallet };
      });

      return {
        message: 'RPC vendido com sucesso.',
        fiatAmount: result.fiatAmount,
        rpcAmount: result.rpcAmount,
        priceBefore: result.priceBefore,
        priceAfter: result.priceAfter,
        wallet: {
          fiatAvailableBalance: result.wallet.fiatAvailableBalance,
          rpcAvailableBalance: result.wallet.rpcAvailableBalance,
        },
      };
    } catch (error) {
      return reply.status(400).send({ message: (error as Error).message });
    }
  });
}
