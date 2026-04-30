import { Decimal } from '@prisma/client/runtime/library';
import { Prisma } from '@prisma/client';
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';

const MIN_AMOUNT = new Decimal('0.01');
const PRICE_SCALE = 8;
const RESERVE_SCALE = 2;
const RPC_MARKET_STATE_ID = 'RPC_MARKET_MAIN';

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
  return prisma.rpcMarketState.upsert({
    where: { id: RPC_MARKET_STATE_ID },
    update: {},
    create: {
      id: RPC_MARKET_STATE_ID,
      currentPrice: new Decimal('1.00000000'),
      fiatReserve: new Decimal('1000000.00'),
      rpcReserve: new Decimal('1000000.00'),
    },
  });
}

function buildBuyQuote(state: { currentPrice: Decimal; fiatReserve: Decimal; rpcReserve: Decimal }, fiatAmount: Decimal) {
  const k = toDecimal(state.fiatReserve).mul(state.rpcReserve);
  const newFiatReserve = toDecimal(state.fiatReserve).add(fiatAmount);
  const newRpcReserve = k.div(newFiatReserve).toDecimalPlaces(RESERVE_SCALE);
  ensurePositive(newRpcReserve, 'Liquidez RPC insuficiente para esta operação.');
  const rpcAmount = toDecimal(state.rpcReserve).sub(newRpcReserve).toDecimalPlaces(2);
  if (rpcAmount.lt(MIN_AMOUNT)) throw new Error('Operação muito pequena para execução.');
  const priceAfter = newFiatReserve.div(newRpcReserve).toDecimalPlaces(PRICE_SCALE);
  const unitPrice = fiatAmount.div(rpcAmount).toDecimalPlaces(PRICE_SCALE);
  return { rpcAmount, priceBefore: state.currentPrice, priceAfter, unitPrice, newFiatReserve, newRpcReserve };
}

function buildSellQuote(state: { currentPrice: Decimal; fiatReserve: Decimal; rpcReserve: Decimal }, rpcAmount: Decimal) {
  const k = toDecimal(state.fiatReserve).mul(state.rpcReserve);
  const newRpcReserve = toDecimal(state.rpcReserve).add(rpcAmount);
  const newFiatReserve = k.div(newRpcReserve).toDecimalPlaces(RESERVE_SCALE);
  ensurePositive(newFiatReserve, 'Liquidez fiat insuficiente para esta operação.');
  const fiatAmount = toDecimal(state.fiatReserve).sub(newFiatReserve).toDecimalPlaces(2);
  if (fiatAmount.lt(MIN_AMOUNT)) throw new Error('Operação muito pequena para execução.');
  const priceAfter = newFiatReserve.div(newRpcReserve).toDecimalPlaces(PRICE_SCALE);
  const unitPrice = fiatAmount.div(rpcAmount).toDecimalPlaces(PRICE_SCALE);
  return { fiatAmount, priceBefore: state.currentPrice, priceAfter, unitPrice, newFiatReserve, newRpcReserve };
}

export async function rpcMarketRoutes(app: FastifyInstance) {
  app.get('/rpc-market', async () => ensureMarketState());

  app.get('/rpc-market/quote-buy', async (request, reply) => {
    try {
      const query = z.object({ fiatAmount: z.coerce.number().min(0.01) }).parse(request.query ?? {});
      const fiatAmount = toDecimal(query.fiatAmount).toDecimalPlaces(2);
      const state = await ensureMarketState();
      const quote = buildBuyQuote(state, fiatAmount);
      return {
        fiatAmount,
        estimatedRpcAmount: quote.rpcAmount,
        priceBefore: quote.priceBefore,
        estimatedPriceAfter: quote.priceAfter,
        effectiveUnitPrice: quote.unitPrice,
      };
    } catch (error) {
      return reply.status(400).send({ message: (error as Error).message });
    }
  });

  app.get('/rpc-market/quote-sell', async (request, reply) => {
    try {
      const query = z.object({ rpcAmount: z.coerce.number().min(0.01) }).parse(request.query ?? {});
      const rpcAmount = toDecimal(query.rpcAmount).toDecimalPlaces(2);
      const state = await ensureMarketState();
      const quote = buildSellQuote(state, rpcAmount);
      return {
        rpcAmount,
        estimatedFiatAmount: quote.fiatAmount,
        priceBefore: quote.priceBefore,
        estimatedPriceAfter: quote.priceAfter,
        effectiveUnitPrice: quote.unitPrice,
      };
    } catch (error) {
      return reply.status(400).send({ message: (error as Error).message });
    }
  });

  app.get('/rpc-market/trades', async (request) => {
    const query = z.object({ limit: z.coerce.number().int().min(1).max(200).optional() }).parse(request.query ?? {});
    const trades = await prisma.rpcExchangeTrade.findMany({ orderBy: { createdAt: 'desc' }, take: query.limit ?? 50,
      select: { id: true, side: true, fiatAmount: true, rpcAmount: true, unitPrice: true, priceBefore: true, priceAfter: true, createdAt: true } });
    return { trades };
  });

  app.post('/rpc-market/buy', { preHandler: [app.authenticate] }, async (request, reply) => {
    try {
      const body = amountSchema.parse(request.body ?? {});
      if (body.fiatAmount == null) return reply.status(400).send({ message: 'fiatAmount é obrigatório.' });
      const fiatAmount = toDecimal(body.fiatAmount).toDecimalPlaces(2);
      if (fiatAmount.lt(MIN_AMOUNT)) return reply.status(400).send({ message: 'Valor mínimo para compra é R$ 0,01.' });

      const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const wallet = await tx.wallet.findUnique({ where: { userId: (request.user as { sub: string }).sub } });
        if (!wallet) throw new Error('Carteira não encontrada.');

        await tx.rpcMarketState.upsert({ where: { id: RPC_MARKET_STATE_ID }, update: {}, create: { id: RPC_MARKET_STATE_ID, currentPrice: new Decimal('1.00000000'), fiatReserve: new Decimal('1000000.00'), rpcReserve: new Decimal('1000000.00') } });
        await tx.$queryRaw`SELECT id FROM "RpcMarketState" WHERE id = ${RPC_MARKET_STATE_ID} FOR UPDATE`;
        const state = await tx.rpcMarketState.findUniqueOrThrow({ where: { id: RPC_MARKET_STATE_ID } });

        const quote = buildBuyQuote(state, fiatAmount);
        const updatedWallet = await tx.wallet.updateMany({ where: { id: wallet.id, fiatAvailableBalance: { gte: fiatAmount } }, data: { fiatAvailableBalance: { decrement: fiatAmount }, rpcAvailableBalance: { increment: quote.rpcAmount } } });
        if (updatedWallet.count !== 1) throw new Error('Saldo insuficiente.');

        await tx.rpcMarketState.update({ where: { id: RPC_MARKET_STATE_ID }, data: { fiatReserve: quote.newFiatReserve, rpcReserve: quote.newRpcReserve, currentPrice: quote.priceAfter, totalFiatVolume: { increment: fiatAmount }, totalRpcVolume: { increment: quote.rpcAmount }, totalBuys: { increment: 1 } } });
        await tx.rpcExchangeTrade.create({ data: { userId: (request.user as { sub: string }).sub, side: 'BUY_RPC', fiatAmount, rpcAmount: quote.rpcAmount, unitPrice: quote.unitPrice, priceBefore: quote.priceBefore, priceAfter: quote.priceAfter } });
        await tx.transaction.create({ data: { walletId: wallet.id, type: 'RPC_MARKET_BUY', amount: fiatAmount, description: 'Compra de RPC com R$' } });
        const latestWallet = await tx.wallet.findUniqueOrThrow({ where: { id: wallet.id } });
        return { fiatAmount, rpcAmount: quote.rpcAmount, priceBefore: quote.priceBefore, priceAfter: quote.priceAfter, wallet: latestWallet };
      });

      return { message: 'RPC comprado com sucesso.', fiatAmount: result.fiatAmount, rpcAmount: result.rpcAmount, priceBefore: result.priceBefore, priceAfter: result.priceAfter, wallet: { fiatAvailableBalance: result.wallet.fiatAvailableBalance, rpcAvailableBalance: result.wallet.rpcAvailableBalance } };
    } catch (error) {
      return reply.status(400).send({ message: (error as Error).message });
    }
  });

  app.post('/rpc-market/sell', { preHandler: [app.authenticate] }, async (request, reply) => {
    try {
      const body = amountSchema.parse(request.body ?? {});
      if (body.rpcAmount == null) return reply.status(400).send({ message: 'rpcAmount é obrigatório.' });
      const rpcAmount = toDecimal(body.rpcAmount).toDecimalPlaces(2);
      if (rpcAmount.lt(MIN_AMOUNT)) return reply.status(400).send({ message: 'Valor mínimo para venda é 0,01 RPC.' });

      const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const wallet = await tx.wallet.findUnique({ where: { userId: (request.user as { sub: string }).sub } });
        if (!wallet) throw new Error('Carteira não encontrada.');

        await tx.rpcMarketState.upsert({ where: { id: RPC_MARKET_STATE_ID }, update: {}, create: { id: RPC_MARKET_STATE_ID, currentPrice: new Decimal('1.00000000'), fiatReserve: new Decimal('1000000.00'), rpcReserve: new Decimal('1000000.00') } });
        await tx.$queryRaw`SELECT id FROM "RpcMarketState" WHERE id = ${RPC_MARKET_STATE_ID} FOR UPDATE`;
        const state = await tx.rpcMarketState.findUniqueOrThrow({ where: { id: RPC_MARKET_STATE_ID } });

        const quote = buildSellQuote(state, rpcAmount);
        const updatedWallet = await tx.wallet.updateMany({ where: { id: wallet.id, rpcAvailableBalance: { gte: rpcAmount } }, data: { rpcAvailableBalance: { decrement: rpcAmount }, fiatAvailableBalance: { increment: quote.fiatAmount } } });
        if (updatedWallet.count !== 1) throw new Error('Saldo insuficiente.');

        await tx.rpcMarketState.update({ where: { id: RPC_MARKET_STATE_ID }, data: { fiatReserve: quote.newFiatReserve, rpcReserve: quote.newRpcReserve, currentPrice: quote.priceAfter, totalFiatVolume: { increment: quote.fiatAmount }, totalRpcVolume: { increment: rpcAmount }, totalSells: { increment: 1 } } });
        await tx.rpcExchangeTrade.create({ data: { userId: (request.user as { sub: string }).sub, side: 'SELL_RPC', fiatAmount: quote.fiatAmount, rpcAmount, unitPrice: quote.unitPrice, priceBefore: quote.priceBefore, priceAfter: quote.priceAfter } });
        await tx.transaction.create({ data: { walletId: wallet.id, type: 'RPC_MARKET_SELL', amount: quote.fiatAmount, description: 'Venda de RPC por R$' } });
        const latestWallet = await tx.wallet.findUniqueOrThrow({ where: { id: wallet.id } });
        return { fiatAmount: quote.fiatAmount, rpcAmount, priceBefore: quote.priceBefore, priceAfter: quote.priceAfter, wallet: latestWallet };
      });

      return { message: 'RPC vendido com sucesso.', fiatAmount: result.fiatAmount, rpcAmount: result.rpcAmount, priceBefore: result.priceBefore, priceAfter: result.priceAfter, wallet: { fiatAvailableBalance: result.wallet.fiatAvailableBalance, rpcAvailableBalance: result.wallet.rpcAvailableBalance } };
    } catch (error) {
      return reply.status(400).send({ message: (error as Error).message });
    }
  });
}
