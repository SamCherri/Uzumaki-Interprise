import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { FastifyInstance, FastifyReply } from 'fastify';
import { ZodError, z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { MAX_REPORTS_PER_HOUR } from '../config/anti-abuse-limits.js';
import { assertTestMode, isAdminRole } from '../plugins/system-mode-guard.js';

const MARKET_ID = 'TEST_MODE_MARKET_MAIN';
const MIN_AMOUNT = new Decimal('0.01');
const CONTROL_ROLES = new Set(['SUPER_ADMIN', 'COIN_CHIEF_ADMIN']);
const BOT_TICK_COOLDOWN_SECONDS = 20;

function toDecimal(v: number | string | Decimal) { return v instanceof Decimal ? v : new Decimal(v); }
function isControlRole(roles: string[]) { return roles.some((r) => CONTROL_ROLES.has(r.toUpperCase())); }
function isSuperAdmin(roles: string[]) { return roles.some((r) => r.toUpperCase() === 'SUPER_ADMIN'); }
function badRequest(reply: FastifyReply, error: unknown) { const msg = error instanceof ZodError ? error.issues[0]?.message ?? 'Dados inválidos.' : (error as Error).message || 'Dados inválidos.'; return reply.status(400).send({ message: msg }); }
async function ensureMarket() { return prisma.testModeMarketState.upsert({ where: { id: MARKET_ID }, update: {}, create: { id: MARKET_ID } }); }
async function ensureWallet(userId: string) { return prisma.testModeWallet.upsert({ where: { userId }, update: {}, create: { userId } }); }

function buildBuyQuote(state: { currentPrice: Decimal; fiatReserve: Decimal; rpcReserve: Decimal }, fiatAmount: Decimal) {
  const k = state.fiatReserve.mul(state.rpcReserve);
  const newFiatReserve = state.fiatReserve.add(fiatAmount);
  const newRpcReserve = k.div(newFiatReserve).toDecimalPlaces(2);
  const rpcAmount = state.rpcReserve.sub(newRpcReserve).toDecimalPlaces(2);
  const priceAfter = newFiatReserve.div(newRpcReserve).toDecimalPlaces(8);
  const unitPrice = fiatAmount.div(rpcAmount).toDecimalPlaces(8);
  return { rpcAmount, priceBefore: state.currentPrice, priceAfter, unitPrice, newFiatReserve, newRpcReserve };
}
function buildSellQuote(state: { currentPrice: Decimal; fiatReserve: Decimal; rpcReserve: Decimal }, rpcAmount: Decimal) {
  const k = state.fiatReserve.mul(state.rpcReserve);
  const newRpcReserve = state.rpcReserve.add(rpcAmount);
  const newFiatReserve = k.div(newRpcReserve).toDecimalPlaces(2);
  const fiatAmount = state.fiatReserve.sub(newFiatReserve).toDecimalPlaces(2);
  const priceAfter = newFiatReserve.div(newRpcReserve).toDecimalPlaces(8);
  const unitPrice = fiatAmount.div(rpcAmount).toDecimalPlaces(8);
  return { fiatAmount, priceBefore: state.currentPrice, priceAfter, unitPrice, newFiatReserve, newRpcReserve };
}

export async function testModeRoutes(app: FastifyInstance) {
  app.get('/test-mode/me', { preHandler: [app.authenticate] }, async (request, reply) => { if (!(await assertTestMode(reply))) return; return ensureWallet((request.user as { sub: string }).sub); });
  app.get('/test-mode/market', { preHandler: [app.authenticate] }, async (_req, reply) => { if (!(await assertTestMode(reply))) return; return ensureMarket(); });
  app.get('/test-mode/trades', { preHandler: [app.authenticate] }, async (request, reply) => { try { if (!(await assertTestMode(reply))) return; const q = z.object({ limit: z.coerce.number().int().min(1).max(200).optional() }).parse(request.query ?? {}); return { trades: await prisma.testModeTrade.findMany({ take: q.limit ?? 50, orderBy: { createdAt: 'desc' } }) }; } catch (e) { return badRequest(reply, e); } });
  app.get('/test-mode/quote-buy', { preHandler: [app.authenticate] }, async (request, reply) => { try { if (!(await assertTestMode(reply))) return; const { fiatAmount } = z.object({ fiatAmount: z.coerce.number().min(0.01) }).parse(request.query ?? {}); const market = await ensureMarket(); const quote = buildBuyQuote(market, toDecimal(fiatAmount).toDecimalPlaces(2)); return { fiatAmount, estimatedRpcAmount: quote.rpcAmount, effectiveUnitPrice: quote.unitPrice, estimatedPriceAfter: quote.priceAfter }; } catch (e) { return badRequest(reply, e); } });
  app.get('/test-mode/quote-sell', { preHandler: [app.authenticate] }, async (request, reply) => { try { if (!(await assertTestMode(reply))) return; const { rpcAmount } = z.object({ rpcAmount: z.coerce.number().min(0.01) }).parse(request.query ?? {}); const market = await ensureMarket(); const quote = buildSellQuote(market, toDecimal(rpcAmount).toDecimalPlaces(2)); return { rpcAmount, estimatedFiatAmount: quote.fiatAmount, effectiveUnitPrice: quote.unitPrice, estimatedPriceAfter: quote.priceAfter }; } catch (e) { return badRequest(reply, e); } });

  app.post('/test-mode/buy', { preHandler: [app.authenticate], config: { rateLimit: process.env.NODE_ENV === 'test' ? false : { max: 60, timeWindow: '1 minute' } } }, async (request, reply) => {
    try {
      if (!(await assertTestMode(reply))) return;
      const { fiatAmount } = z.object({ fiatAmount: z.coerce.number().min(0.01) }).parse(request.body ?? {});
      return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const userId = (request.user as { sub: string }).sub;
        const wallet = await tx.testModeWallet.upsert({ where: { userId }, update: {}, create: { userId } });
        await tx.testModeMarketState.upsert({ where: { id: MARKET_ID }, update: {}, create: { id: MARKET_ID } });
        await tx.$queryRaw`SELECT id FROM "TestModeMarketState" WHERE id = ${MARKET_ID} FOR UPDATE`;
        const market = await tx.testModeMarketState.findUniqueOrThrow({ where: { id: MARKET_ID } });
        const fiat = toDecimal(fiatAmount).toDecimalPlaces(2);
        if (wallet.fiatBalance.lt(fiat)) throw new Error('Saldo insuficiente.');
        const quote = buildBuyQuote(market, fiat);
        if (quote.rpcAmount.lt(MIN_AMOUNT)) throw new Error('Operação muito pequena.');
        const update = await tx.testModeWallet.updateMany({ where: { userId, fiatBalance: { gte: fiat } }, data: { fiatBalance: { decrement: fiat }, rpcBalance: { increment: quote.rpcAmount } } });
        if (update.count !== 1) throw new Error('Saldo insuficiente.');
        await tx.testModeMarketState.update({ where: { id: MARKET_ID }, data: { currentPrice: quote.priceAfter, fiatReserve: quote.newFiatReserve, rpcReserve: quote.newRpcReserve, totalFiatVolume: { increment: fiat }, totalRpcVolume: { increment: quote.rpcAmount }, totalBuys: { increment: 1 } } });
        await tx.testModeTrade.create({ data: { userId, side: 'BUY', fiatAmount: fiat, rpcAmount: quote.rpcAmount, unitPrice: quote.unitPrice, priceBefore: quote.priceBefore, priceAfter: quote.priceAfter } });
        return { message: 'Compra de teste realizada.' };
      });
    } catch (e) { return badRequest(reply, e); }
  });

  app.post('/test-mode/sell', { preHandler: [app.authenticate], config: { rateLimit: process.env.NODE_ENV === 'test' ? false : { max: 60, timeWindow: '1 minute' } } }, async (request, reply) => {
    try {
      if (!(await assertTestMode(reply))) return;
      const { rpcAmount } = z.object({ rpcAmount: z.coerce.number().min(0.01) }).parse(request.body ?? {});
      return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const userId = (request.user as { sub: string }).sub;
        const wallet = await tx.testModeWallet.upsert({ where: { userId }, update: {}, create: { userId } });
        await tx.testModeMarketState.upsert({ where: { id: MARKET_ID }, update: {}, create: { id: MARKET_ID } });
        await tx.$queryRaw`SELECT id FROM "TestModeMarketState" WHERE id = ${MARKET_ID} FOR UPDATE`;
        const market = await tx.testModeMarketState.findUniqueOrThrow({ where: { id: MARKET_ID } });
        const rpc = toDecimal(rpcAmount).toDecimalPlaces(2);
        if (wallet.rpcBalance.lt(rpc)) throw new Error('Saldo insuficiente.');
        const quote = buildSellQuote(market, rpc);
        const update = await tx.testModeWallet.updateMany({ where: { userId, rpcBalance: { gte: rpc } }, data: { rpcBalance: { decrement: rpc }, fiatBalance: { increment: quote.fiatAmount } } });
        if (update.count !== 1) throw new Error('Saldo insuficiente.');
        await tx.testModeMarketState.update({ where: { id: MARKET_ID }, data: { currentPrice: quote.priceAfter, fiatReserve: quote.newFiatReserve, rpcReserve: quote.newRpcReserve, totalFiatVolume: { increment: quote.fiatAmount }, totalRpcVolume: { increment: rpc }, totalSells: { increment: 1 } } });
        await tx.testModeTrade.create({ data: { userId, side: 'SELL', fiatAmount: quote.fiatAmount, rpcAmount: rpc, unitPrice: quote.unitPrice, priceBefore: quote.priceBefore, priceAfter: quote.priceAfter } });
        return { message: 'Venda de teste realizada.' };
      });
    } catch (e) { return badRequest(reply, e); }
  });


  app.post('/test-mode/bot-tick', { preHandler: [app.authenticate], config: { rateLimit: process.env.NODE_ENV === 'test' ? false : { max: 20, timeWindow: '1 minute' } } }, async (_request, reply) => {
    try {
      if (!(await assertTestMode(reply))) return;
      return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        await tx.testModeMarketState.upsert({ where: { id: MARKET_ID }, update: {}, create: { id: MARKET_ID } });
        await tx.$queryRaw`SELECT id FROM "TestModeMarketState" WHERE id = ${MARKET_ID} FOR UPDATE`;
        const market = await tx.testModeMarketState.findUniqueOrThrow({ where: { id: MARKET_ID } });
        const elapsedSeconds = (Date.now() - market.updatedAt.getTime()) / 1000;
        if (elapsedSeconds < BOT_TICK_COOLDOWN_SECONDS) {
          return { skipped: true, message: 'Tick ignorado por cooldown.', currentPrice: market.currentPrice };
        }

        const side: 'BUY' | 'SELL' = Math.random() < 0.5 ? 'BUY' : 'SELL';
        const priceBefore = market.currentPrice;

        if (side === 'BUY') {
          const maxBuy = Decimal.min(new Decimal('250'), market.fiatReserve.mul(new Decimal('0.005'))).toDecimalPlaces(2);
          const minBuy = new Decimal('20');
          if (maxBuy.lt(minBuy)) return reply.status(400).send({ message: 'Liquidez insuficiente para tick de compra.' });
          const fiatAmount = Decimal.max(minBuy, new Decimal((Math.random() * (Number(maxBuy.minus(minBuy)) || 0)).toFixed(2)).add(minBuy)).toDecimalPlaces(2);
          const quote = buildBuyQuote(market, fiatAmount);
          if (quote.rpcAmount.lt(MIN_AMOUNT)) return reply.status(400).send({ message: 'Liquidez insuficiente para tick de compra.' });
          await tx.testModeMarketState.update({ where: { id: MARKET_ID }, data: { currentPrice: quote.priceAfter, fiatReserve: quote.newFiatReserve, rpcReserve: quote.newRpcReserve, totalFiatVolume: { increment: fiatAmount }, totalRpcVolume: { increment: quote.rpcAmount }, totalBuys: { increment: 1 } } });
          return { side, fiatAmount, rpcAmount: quote.rpcAmount, priceBefore, priceAfter: quote.priceAfter, currentPrice: quote.priceAfter };
        }

        const maxSell = Decimal.min(new Decimal('25'), market.rpcReserve.mul(new Decimal('0.005'))).toDecimalPlaces(2);
        const minSell = new Decimal('2');
        if (maxSell.lt(minSell)) return reply.status(400).send({ message: 'Liquidez insuficiente para tick de venda.' });
        const rpcAmount = Decimal.max(minSell, new Decimal((Math.random() * (Number(maxSell.minus(minSell)) || 0)).toFixed(2)).add(minSell)).toDecimalPlaces(2);
        const quote = buildSellQuote(market, rpcAmount);
        if (quote.fiatAmount.lt(MIN_AMOUNT)) return reply.status(400).send({ message: 'Liquidez insuficiente para tick de venda.' });
        await tx.testModeMarketState.update({ where: { id: MARKET_ID }, data: { currentPrice: quote.priceAfter, fiatReserve: quote.newFiatReserve, rpcReserve: quote.newRpcReserve, totalFiatVolume: { increment: quote.fiatAmount }, totalRpcVolume: { increment: rpcAmount }, totalSells: { increment: 1 } } });
        return { side, fiatAmount: quote.fiatAmount, rpcAmount, priceBefore, priceAfter: quote.priceAfter, currentPrice: quote.priceAfter };
      });
    } catch (e) { return badRequest(reply, e); }
  });

  app.get('/test-mode/leaderboard', { preHandler: [app.authenticate] }, async (_request, reply) => { if (!(await assertTestMode(reply))) return; const market = await ensureMarket(); const wallets = await prisma.testModeWallet.findMany({ include: { user: true } }); const leaderboard = wallets.map((w: (typeof wallets)[number]) => ({ userId: w.userId, name: w.user.name, characterName: w.user.characterName, fiatBalance: w.fiatBalance, rpcBalance: w.rpcBalance, estimatedTotalFiat: w.fiatBalance.add(w.rpcBalance.mul(market.currentPrice)) })).sort((a: { estimatedTotalFiat: Decimal }, b: { estimatedTotalFiat: Decimal }) => b.estimatedTotalFiat.comparedTo(a.estimatedTotalFiat)).map((item: { userId: string; name: string | null; characterName: string | null; fiatBalance: Decimal; rpcBalance: Decimal; estimatedTotalFiat: Decimal }, i: number) => ({ ...item, position: i + 1 })); return { leaderboard }; });
  app.post('/test-mode/reports', { preHandler: [app.authenticate], config: { rateLimit: process.env.NODE_ENV === 'test' ? false : { max: 20, timeWindow: '1 hour' } } }, async (request, reply) => { try { if (!(await assertTestMode(reply))) return; const body = z.object({ type: z.enum(['BUG', 'VISUAL_ERROR', 'BALANCE_ERROR', 'CHEAT_SUSPECTED', 'SUGGESTION', 'OTHER']), location: z.string().min(2), description: z.string().min(5) }).parse(request.body ?? {}); const userId = (request.user as { sub: string }).sub; const oneHourAgo = new Date(Date.now() - (60 * 60 * 1000)); const recentReports = await prisma.testModeReport.count({ where: { userId, createdAt: { gte: oneHourAgo } } }); if (recentReports >= MAX_REPORTS_PER_HOUR) return reply.status(429).send({ message: 'Limite de reports por hora atingido. Aguarde antes de enviar outro.' }); const wallet = await ensureWallet(userId); const market = await ensureMarket(); const report = await prisma.testModeReport.create({ data: { userId, ...body, userSnapshot: JSON.stringify({ fiatBalance: wallet.fiatBalance.toString(), rpcBalance: wallet.rpcBalance.toString(), currentPrice: market.currentPrice.toString() }) } }); return reply.status(201).send(report); } catch (e) { return badRequest(reply, e); } });

  app.get('/admin/test-mode/reports', { preHandler: [app.authenticate] }, async (request, reply) => { try { const roles = ((request.user as { roles?: string[] }).roles ?? []); if (!isAdminRole(roles)) return reply.status(403).send({ message: 'Sem permissão.' }); const q = z.object({ status: z.string().optional(), type: z.string().optional() }).parse(request.query ?? {}); return prisma.testModeReport.findMany({ where: { status: q.status, type: q.type }, orderBy: { createdAt: 'desc' } }); } catch (e) { return badRequest(reply, e); } });
  app.patch('/admin/test-mode/reports/:id', { preHandler: [app.authenticate], config: { rateLimit: process.env.NODE_ENV === 'test' ? false : { max: 20, timeWindow: '1 minute' } } }, async (request, reply) => { try { const roles = ((request.user as { roles?: string[] }).roles ?? []); if (!isAdminRole(roles)) return reply.status(403).send({ message: 'Sem permissão.' }); const params = z.object({ id: z.string() }).parse(request.params); const body = z.object({ status: z.enum(['OPEN', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED']), adminNote: z.string().optional() }).parse(request.body ?? {}); const updated = await prisma.testModeReport.update({ where: { id: params.id }, data: body }); await app.logAdmin({ userId: (request.user as { sub: string }).sub, action: 'TEST_MODE_REPORT_UPDATE', entity: 'TestModeReport', current: JSON.stringify(updated) }); return updated; } catch (e) { return badRequest(reply, e); } });

  app.post('/admin/test-mode/reset-user', { preHandler: [app.authenticate], config: { rateLimit: process.env.NODE_ENV === 'test' ? false : { max: 10, timeWindow: '1 minute' } } }, async (request, reply) => {
    try {
      const roles = ((request.user as { roles?: string[] }).roles ?? []);
      if (!isControlRole(roles)) return reply.status(403).send({ message: 'Sem permissão.' });
      const body = z.object({ userId: z.string().optional(), email: z.string().email().optional(), reason: z.string().min(10) }).refine((v) => Boolean(v.userId || v.email), { message: 'Informe userId ou email.' }).parse(request.body ?? {});
      const user = body.userId ? await prisma.user.findUnique({ where: { id: body.userId } }) : await prisma.user.findUnique({ where: { email: body.email! } });
      if (!user) return reply.status(404).send({ message: 'Usuário não encontrado.' });
      const prev = await prisma.testModeWallet.findUnique({ where: { userId: user.id } });
      const updated = await prisma.testModeWallet.upsert({ where: { userId: user.id }, update: { fiatBalance: new Decimal('10000.00'), rpcBalance: new Decimal('0.00') }, create: { userId: user.id } });
      await app.logAdmin({ userId: (request.user as { sub: string }).sub, action: 'TEST_MODE_RESET_USER', entity: 'TestModeWallet', reason: body.reason, previous: JSON.stringify(prev), current: JSON.stringify(updated) });
      return { message: 'Carteira de teste resetada.', wallet: updated };
    } catch (e) { return badRequest(reply, e); }
  });

  app.post('/admin/test-mode/reset-market', { preHandler: [app.authenticate], config: { rateLimit: process.env.NODE_ENV === 'test' ? false : { max: 10, timeWindow: '1 minute' } } }, async (request, reply) => { try { const roles = ((request.user as { roles?: string[] }).roles ?? []); if (!isControlRole(roles)) return reply.status(403).send({ message: 'Sem permissão.' }); const body = z.object({ reason: z.string().min(10) }).parse(request.body ?? {}); const prev = await prisma.testModeMarketState.findUnique({ where: { id: MARKET_ID } }); const updated = await prisma.testModeMarketState.upsert({ where: { id: MARKET_ID }, update: { currentPrice: new Decimal('1.00000000'), fiatReserve: new Decimal('1000000.00'), rpcReserve: new Decimal('1000000.00'), totalFiatVolume: new Decimal('0'), totalRpcVolume: new Decimal('0'), totalBuys: 0, totalSells: 0 }, create: { id: MARKET_ID } }); await app.logAdmin({ userId: (request.user as { sub: string }).sub, action: 'TEST_MODE_RESET_MARKET', entity: 'TestModeMarketState', reason: body.reason, previous: JSON.stringify(prev), current: JSON.stringify(updated) }); return updated; } catch (e) { return badRequest(reply, e); } });

  app.post('/admin/test-mode/clear', { preHandler: [app.authenticate], config: { rateLimit: process.env.NODE_ENV === 'test' ? false : { max: 5, timeWindow: '1 minute' } } }, async (request, reply) => {
    try {
      const roles = ((request.user as { roles?: string[] }).roles ?? []);
      if (!isSuperAdmin(roles)) return reply.status(403).send({ message: 'Sem permissão.' });
      const body = z.object({ reason: z.string().min(10), confirmation: z.literal('LIMPAR MODO TESTE') }).parse(request.body ?? {});
      const previous = { trades: await prisma.testModeTrade.count(), wallets: await prisma.testModeWallet.count(), reports: await prisma.testModeReport.count(), marketExists: Boolean(await prisma.testModeMarketState.findUnique({ where: { id: MARKET_ID } })) };
      await prisma.$transaction(async (tx: Prisma.TransactionClient) => { await tx.testModeTrade.deleteMany(); await tx.testModeReport.deleteMany(); await tx.testModeWallet.deleteMany(); await tx.testModeMarketState.deleteMany(); await tx.testModeMarketState.create({ data: { id: MARKET_ID } }); });
      const current = { trades: await prisma.testModeTrade.count(), wallets: await prisma.testModeWallet.count(), reports: await prisma.testModeReport.count(), marketExists: Boolean(await prisma.testModeMarketState.findUnique({ where: { id: MARKET_ID } })) };
      await app.logAdmin({ userId: (request.user as { sub: string }).sub, action: 'TEST_MODE_CLEAR', entity: 'TestModeData', reason: body.reason, previous: JSON.stringify(previous), current: JSON.stringify(current) });
      return { message: 'Dados de teste limpos com sucesso.' };
    } catch (e) { return badRequest(reply, e); }
  });
}
