import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { COMPANY_MARKET_MAX_OPEN_ORDERS_PER_USER, MAX_PENDING_WITHDRAWALS_PER_USER, MAX_PROJECT_CREATIONS_PER_DAY, MAX_REPORTS_PER_HOUR, RPC_MARKET_MAX_OPEN_ORDERS_PER_USER } from '../src/config/anti-abuse-limits.js';
if (!process.env.TEST_DATABASE_URL) throw new Error('TEST_DATABASE_URL é obrigatório');
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
const [{ buildApp }, { prisma }] = await Promise.all([import('../src/app.js'), import('../src/lib/prisma.js')]);
const app = buildApp();
async function resetDb(){ await prisma.$transaction([prisma.trade.deleteMany(),prisma.marketOrder.deleteMany(),prisma.rpcLimitOrder.deleteMany(),prisma.withdrawalRequest.deleteMany(),prisma.testModeReport.deleteMany(),prisma.company.deleteMany(),prisma.wallet.deleteMany(),prisma.userRole.deleteMany(),prisma.role.deleteMany(),prisma.user.deleteMany()]); }
async function mkUser(email:string){ return prisma.user.create({data:{email,name:email,passwordHash:await bcrypt.hash('123456',10),wallet:{create:{fiatAvailableBalance:10000,rpcAvailableBalance:10000}}}})}
async function token(id:string){ return app.jwt.sign({sub:id,roles:['USER']}); }
test.before(async()=>{await app.ready(); await resetDb(); await prisma.role.create({data:{key:'USER',name:'USER'}});});
test.after(async()=>{await app.close(); await prisma.$disconnect();});

test('bloqueia limites principais', async()=>{
  await resetDb(); await prisma.role.create({data:{key:'USER',name:'USER'}});
  const u=await mkUser('a@a.com'); const tk=await token(u.id);
  await prisma.rpcLimitOrder.createMany({data:Array.from({length:RPC_MARKET_MAX_OPEN_ORDERS_PER_USER},()=>({userId:u.id,side:'BUY_RPC',status:'OPEN',limitPrice:1,fiatAmount:1,lockedFiatAmount:1,rpcAmount:null,lockedRpcAmount:0}))});
  let r=await app.inject({method:'POST',url:'/api/rpc-market/orders',headers:{authorization:`Bearer ${tk}`},payload:{side:'BUY_RPC',fiatAmount:1,limitPrice:1}});
  assert.equal(r.statusCode,429);
  await prisma.withdrawalRequest.createMany({data:Array.from({length:MAX_PENDING_WITHDRAWALS_PER_USER},(_,i)=>({code:`WD-X${i}`,userId:u.id,amount:1,status:'PENDING'}))});
  r=await app.inject({method:'POST',url:'/api/withdrawals',headers:{authorization:`Bearer ${tk}`},payload:{amount:1}});
  assert.equal(r.statusCode,400);
  await prisma.testModeReport.createMany({data:Array.from({length:MAX_REPORTS_PER_HOUR},()=>({userId:u.id,type:'BUG',location:'x',description:'teste',userSnapshot:'{}'}))});
  r=await app.inject({method:'POST',url:'/api/test-mode/reports',headers:{authorization:`Bearer ${tk}`},payload:{type:'BUG',location:'x',description:'teste novo'}});
  assert.ok([400,429].includes(r.statusCode));
  await prisma.company.createMany({data:Array.from({length:MAX_PROJECT_CREATIONS_PER_DAY},(_,i)=>({name:`C${i}`,ticker:`TK${i}A`,description:'d',sector:'s',founderUserId:u.id,ownerId:u.id,status:'PENDING_APPROVAL',totalShares:1000,circulatingShares:0,ownerSharePercent:40,publicOfferPercent:60,ownerShares:400,publicOfferShares:600,availableOfferShares:600,initialPrice:1,currentPrice:1,buyFeePercent:1,sellFeePercent:1,fictitiousMarketCap:1000}))});
  r=await app.inject({method:'POST',url:'/api/companies/request',headers:{authorization:`Bearer ${tk}`},payload:{name:'Nova',ticker:'NOVA',description:'desc',sector:'setor',totalShares:1000,ownerSharePercent:40,publicOfferPercent:60,initialPrice:1,buyFeePercent:1,sellFeePercent:1}});
  assert.equal(r.statusCode,429);
});
