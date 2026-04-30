import test from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';

if (process.env.NODE_ENV === 'production') throw new Error('Testes não podem rodar em produção.');
if (!process.env.TEST_DATABASE_URL) throw new Error('TEST_DATABASE_URL é obrigatório para testes de integração.');
if ((process.env.DATABASE_URL || '').includes('railway') && !process.env.TEST_DATABASE_URL) throw new Error('Recusado: sem TEST_DATABASE_URL isolado.');
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

const prisma = new PrismaClient();
const app = buildApp();

async function resetDb() {
  await prisma.$transaction([
    prisma.feeDistribution.deleteMany(), prisma.trade.deleteMany(), prisma.marketOrder.deleteMany(), prisma.companyOperation.deleteMany(), prisma.companyHolding.deleteMany(), prisma.companyInitialOffer.deleteMany(), prisma.companyRevenueAccount.deleteMany(), prisma.companyBoostInjection.deleteMany(), prisma.companyBoostAccount.deleteMany(), prisma.company.deleteMany(), prisma.coinTransfer.deleteMany(), prisma.coinIssuance.deleteMany(), prisma.transaction.deleteMany(), prisma.withdrawalRequest.deleteMany(), prisma.adminLog.deleteMany(), prisma.brokerAccount.deleteMany(), prisma.wallet.deleteMany(), prisma.userRole.deleteMany(), prisma.permission.deleteMany(), prisma.rolePermission.deleteMany(), prisma.role.deleteMany(), prisma.user.deleteMany(), prisma.platformAccount.deleteMany(), prisma.treasuryAccount.deleteMany(),
  ]);
}
async function mkUser(email:string,name='User'){ return prisma.user.create({data:{email,name,passwordHash:'hash',wallet:{create:{}}}})}
async function mkRole(key:string){ return prisma.role.create({data:{key,name:key}})}
async function token(userId:string,roles:string[]){ return app.jwt.sign({sub:userId,roles}); }

test.before(async()=>{ await app.ready(); await resetDb(); });
test.after(async()=>{ await app.close(); await prisma.$disconnect(); });

test('matching multi-fill mantém saldos e preço final', async () => {
  await resetDb();
  const [rUser] = await Promise.all([mkRole('USER')]);
  const buyer=await mkUser('buyer@test.local','Buyer');
  const sellers=await Promise.all([mkUser('s1@test.local'),mkUser('s2@test.local'),mkUser('s3@test.local')]);
  for (const u of [buyer,...sellers]) await prisma.userRole.create({data:{userId:u.id,roleId:rUser.id}});
  await prisma.wallet.update({where:{userId:buyer.id},data:{availableBalance:1000}});
  const company=await prisma.company.create({data:{name:'Comp',ticker:'CMP1',description:'d',sector:'s',founderUserId:buyer.id,status:'ACTIVE',totalShares:1000,circulatingShares:300,ownerSharePercent:40,publicOfferPercent:60,ownerShares:400,publicOfferShares:600,availableOfferShares:300,initialPrice:10,currentPrice:10,buyFeePercent:1,sellFeePercent:1,fictitiousMarketCap:10000,approvedAt:new Date(),revenueAccount:{create:{}}}});
  for(const s of sellers){ await prisma.companyHolding.create({data:{userId:s.id,companyId:company.id,shares:100,averageBuyPrice:10,estimatedValue:1000}});}  
  const buyerToken=await token(buyer.id,['USER']);
  for (const s of sellers){ const tk=await token(s.id,['USER']); await app.inject({method:'POST',url:`/api/market/companies/${company.id}/orders`,headers:{authorization:`Bearer ${tk}`},payload:{type:'SELL',mode:'LIMIT',quantity:10,limitPrice:10}}); }
  await app.inject({method:'POST',url:`/api/market/companies/${company.id}/orders`,headers:{authorization:`Bearer ${buyerToken}`},payload:{type:'BUY',mode:'LIMIT',quantity:30,limitPrice:10}});
  const trades=await prisma.trade.findMany({where:{companyId:company.id}});
  assert.equal(trades.length,3);
  const sells=await prisma.marketOrder.findMany({where:{companyId:company.id,type:'SELL'}});
  assert.ok(sells.every(o=>o.status==='FILLED'));
  const c=await prisma.company.findUniqueOrThrow({where:{id:company.id}});
  assert.equal(String(c.currentPrice),String(trades[trades.length-1].unitPrice));
  const wallets=await prisma.wallet.findMany();
  assert.ok(wallets.every(w=>Number(w.lockedBalance)>=0));
});

test('export csv exige admin e broker-report valida corretor', async () => {
  await resetDb();
  const rAdmin=await mkRole('ADMIN'); const rUser=await mkRole('USER');
  const admin=await mkUser('admin@test.local'); const user=await mkUser('user@test.local');
  await prisma.userRole.createMany({data:[{userId:admin.id,roleId:rAdmin.id},{userId:user.id,roleId:rUser.id}]});
  const adminToken=await token(admin.id,['ADMIN']); const userToken=await token(user.id,['USER']);
  const ok=await app.inject({method:'GET',url:'/api/admin/reports/export/transactions',headers:{authorization:`Bearer ${adminToken}`}});
  assert.equal(ok.statusCode,200); assert.match(ok.headers['content-type']||'',/text\/csv/);
  assert.match(ok.body,/type|id/i);
  const forbidden=await app.inject({method:'GET',url:'/api/admin/reports/export/transactions',headers:{authorization:`Bearer ${userToken}`}});
  assert.equal(forbidden.statusCode,403);
  const notBroker=await app.inject({method:'GET',url:`/api/admin/reports/export/broker-report?userId=${user.id}`,headers:{authorization:`Bearer ${adminToken}`}});
  assert.equal(notBroker.statusCode,400); assert.match(notBroker.body,/não é corretor/i);
});
