import { Decimal } from '@prisma/client/runtime/library';
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { assertTestMode, ensureSystemModeConfig, guardRealRoutesInTestMode, isAdminRole } from '../plugins/system-mode-guard.js';

const MARKET_ID = 'TEST_MODE_MARKET_MAIN';
const MIN_AMOUNT = new Decimal('0.01');

function toDecimal(v: number | string | Decimal) { return v instanceof Decimal ? v : new Decimal(v); }
async function ensureMarket() { return prisma.testModeMarketState.upsert({ where: { id: MARKET_ID }, update: {}, create: { id: MARKET_ID } }); }
async function ensureWallet(userId: string) { return prisma.testModeWallet.upsert({ where: { userId }, update: {}, create: { userId } }); }

export async function testModeRoutes(app: FastifyInstance) {
  app.get('/test-mode/me', { preHandler: [app.authenticate] }, async (request, reply) => {
    if (!(await assertTestMode(reply))) return;
    return ensureWallet((request.user as { sub: string }).sub);
  });
  app.get('/test-mode/market', { preHandler: [app.authenticate] }, async (_req, reply) => { if (!(await assertTestMode(reply))) return; return ensureMarket(); });
  app.get('/test-mode/trades', { preHandler: [app.authenticate] }, async (request, reply) => { if (!(await assertTestMode(reply))) return; const q=z.object({limit:z.coerce.number().int().min(1).max(200).optional()}).parse(request.query??{}); return { trades: await prisma.testModeTrade.findMany({ take:q.limit??50, orderBy:{createdAt:'desc'} })}; });
  app.get('/test-mode/quote-buy', { preHandler: [app.authenticate] }, async (request, reply) => { if (!(await assertTestMode(reply))) return; const { fiatAmount } = z.object({fiatAmount:z.coerce.number().min(0.01)}).parse(request.query??{}); const market = await ensureMarket(); const rpcAmount = toDecimal(fiatAmount).div(market.currentPrice).toDecimalPlaces(2); return { fiatAmount, estimatedRpcAmount: rpcAmount, effectiveUnitPrice: market.currentPrice }; });
  app.get('/test-mode/quote-sell', { preHandler: [app.authenticate] }, async (request, reply) => { if (!(await assertTestMode(reply))) return; const { rpcAmount } = z.object({rpcAmount:z.coerce.number().min(0.01)}).parse(request.query??{}); const market = await ensureMarket(); const fiatAmount = toDecimal(rpcAmount).mul(market.currentPrice).toDecimalPlaces(2); return { rpcAmount, estimatedFiatAmount: fiatAmount, effectiveUnitPrice: market.currentPrice }; });
  app.post('/test-mode/buy', { preHandler: [app.authenticate] }, async (request, reply) => {
    if (!(await assertTestMode(reply))) return;
    const { fiatAmount } = z.object({ fiatAmount: z.coerce.number().min(0.01) }).parse(request.body ?? {});
    return prisma.$transaction(async (tx) => {
      const userId = (request.user as { sub: string }).sub; const wallet = await tx.testModeWallet.upsert({ where: { userId }, update: {}, create: { userId } }); const market = await tx.testModeMarketState.upsert({ where: { id: MARKET_ID }, update: {}, create: { id: MARKET_ID } });
      const fiat = toDecimal(fiatAmount).toDecimalPlaces(2); if (wallet.fiatBalance.lt(fiat)) return reply.status(400).send({ message: 'Saldo insuficiente.' });
      const rpc = fiat.div(market.currentPrice).toDecimalPlaces(2); if (rpc.lt(MIN_AMOUNT)) return reply.status(400).send({ message: 'Operação muito pequena.' });
      await tx.testModeWallet.update({ where: { userId }, data: { fiatBalance: { decrement: fiat }, rpcBalance: { increment: rpc } } });
      await tx.testModeMarketState.update({ where: { id: MARKET_ID }, data: { totalFiatVolume: { increment: fiat }, totalRpcVolume: { increment: rpc }, totalBuys: { increment: 1 } } });
      await tx.testModeTrade.create({ data: { userId, side: 'BUY', fiatAmount: fiat, rpcAmount: rpc, unitPrice: market.currentPrice, priceBefore: market.currentPrice, priceAfter: market.currentPrice } });
      return { message: 'Compra de teste realizada.' };
    });
  });
  app.post('/test-mode/sell', { preHandler: [app.authenticate] }, async (request, reply) => { if (!(await assertTestMode(reply))) return; const { rpcAmount } = z.object({ rpcAmount: z.coerce.number().min(0.01) }).parse(request.body ?? {}); return prisma.$transaction(async (tx)=>{ const userId=(request.user as {sub:string}).sub; const wallet=await tx.testModeWallet.upsert({where:{userId},update:{},create:{userId}}); const market=await tx.testModeMarketState.upsert({where:{id:MARKET_ID},update:{},create:{id:MARKET_ID}}); const rpc=toDecimal(rpcAmount).toDecimalPlaces(2); if(wallet.rpcBalance.lt(rpc)) return reply.status(400).send({message:'Saldo insuficiente.'}); const fiat=rpc.mul(market.currentPrice).toDecimalPlaces(2); await tx.testModeWallet.update({where:{userId},data:{rpcBalance:{decrement:rpc},fiatBalance:{increment:fiat}}}); await tx.testModeMarketState.update({where:{id:MARKET_ID},data:{totalFiatVolume:{increment:fiat},totalRpcVolume:{increment:rpc},totalSells:{increment:1}}}); await tx.testModeTrade.create({data:{userId,side:'SELL',fiatAmount:fiat,rpcAmount:rpc,unitPrice:market.currentPrice,priceBefore:market.currentPrice,priceAfter:market.currentPrice}}); return {message:'Venda de teste realizada.'};}); });
  app.get('/test-mode/leaderboard', { preHandler: [app.authenticate] }, async (_request, reply) => { if (!(await assertTestMode(reply))) return; const market=await ensureMarket(); const wallets=await prisma.testModeWallet.findMany({include:{user:true}}); const data=wallets.map((w)=>({userId:w.userId,name:w.user.name,characterName:w.user.characterName,fiatBalance:w.fiatBalance,rpcBalance:w.rpcBalance,estimatedTotalFiat:w.fiatBalance.add(w.rpcBalance.mul(market.currentPrice))})).sort((a,b)=>b.estimatedTotalFiat.comparedTo(a.estimatedTotalFiat)).map((r,i)=>({...r,position:i+1})); return { leaderboard:data }; });
  app.post('/test-mode/reports', { preHandler: [app.authenticate] }, async (request) => { const body=z.object({type:z.enum(['BUG','VISUAL_ERROR','BALANCE_ERROR','CHEAT_SUSPECTED','SUGGESTION','OTHER']),location:z.string().min(2),description:z.string().min(5)}).parse(request.body??{}); const userId=(request.user as {sub:string}).sub; const wallet=await ensureWallet(userId); const market=await ensureMarket(); return prisma.testModeReport.create({data:{userId,...body,userSnapshot:JSON.stringify({fiatBalance:wallet.fiatBalance.toString(),rpcBalance:wallet.rpcBalance.toString(),currentPrice:market.currentPrice.toString()})}}); });

  app.addHook('preHandler', async (request, reply) => {
    if (!request.url.startsWith('/api/') || request.url.startsWith('/api/test-mode') || request.url.startsWith('/api/system-mode') || request.url.startsWith('/api/auth') || request.url.startsWith('/api/admin')) return;
    if (!(request as any).user) return;
    return guardRealRoutesInTestMode(request, reply);
  });

  app.get('/admin/test-mode/reports', { preHandler: [app.authenticate] }, async (request, reply) => { const roles=((request.user as {roles?:string[]}).roles??[]); if(!isAdminRole(roles)) return reply.status(403).send({message:'Sem permissão.'}); const q=z.object({status:z.string().optional(),type:z.string().optional()}).parse(request.query??{}); return prisma.testModeReport.findMany({where:{status:q.status,type:q.type},orderBy:{createdAt:'desc'}}); });
  app.patch('/admin/test-mode/reports/:id', { preHandler: [app.authenticate] }, async (request, reply) => { const roles=((request.user as {roles?:string[]}).roles??[]); if(!isAdminRole(roles)) return reply.status(403).send({message:'Sem permissão.'}); const params=z.object({id:z.string()}).parse(request.params); const body=z.object({status:z.enum(['OPEN','UNDER_REVIEW','RESOLVED','DISMISSED']),adminNote:z.string().optional()}).parse(request.body??{}); const updated=await prisma.testModeReport.update({where:{id:params.id},data:body}); await app.logAdmin({userId:(request.user as {sub:string}).sub,action:'TEST_MODE_REPORT_UPDATE',entity:'TestModeReport',current:JSON.stringify(updated)}); return updated; });
  app.post('/admin/test-mode/reset-market', { preHandler: [app.authenticate] }, async (request, reply) => { const roles=((request.user as {roles?:string[]}).roles??[]).map(r=>r.toUpperCase()); if(!roles.includes('SUPER_ADMIN')&&!roles.includes('COIN_CHIEF_ADMIN')) return reply.status(403).send({message:'Sem permissão.'}); const body=z.object({reason:z.string().min(10)}).parse(request.body??{}); const updated=await prisma.testModeMarketState.upsert({where:{id:MARKET_ID},update:{currentPrice:new Decimal('1.00000000'),fiatReserve:new Decimal('1000000.00'),rpcReserve:new Decimal('1000000.00'),totalFiatVolume:new Decimal('0'),totalRpcVolume:new Decimal('0'),totalBuys:0,totalSells:0},create:{id:MARKET_ID}}); await app.logAdmin({userId:(request.user as {sub:string}).sub,action:'TEST_MODE_RESET_MARKET',entity:'TestModeMarketState',reason:body.reason,current:JSON.stringify(updated)}); return updated; });
}
