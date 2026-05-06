import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';

if (process.env.NODE_ENV === 'production') throw new Error('Testes não podem rodar em produção.');
if (!process.env.TEST_DATABASE_URL) throw new Error('TEST_DATABASE_URL é obrigatório para testes de integração.');
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

const [{ buildApp }, { prisma }] = await Promise.all([import('../src/app.js'), import('../src/lib/prisma.js')]);
const app = buildApp();
const PASSWORD = 'Admin@123';

async function resetDb() {
  await prisma.$transaction([
    prisma.projectHolderDistributionPayment.deleteMany(), prisma.projectHolderDistributionSnapshot.deleteMany(), prisma.projectHolderDistributionProgram.deleteMany(),
    prisma.projectTokenReserveEntry.deleteMany(), prisma.projectTokenReserve.deleteMany(), prisma.projectBuybackExecution.deleteMany(), prisma.projectBuybackProgram.deleteMany(), prisma.companyCapitalFlowEntry.deleteMany(),
    prisma.coinIssuance.deleteMany(), prisma.coinTransfer.deleteMany(), prisma.adminLog.deleteMany(), prisma.trade.deleteMany(), prisma.marketOrder.deleteMany(), prisma.companyHolding.deleteMany(), prisma.companyRevenueAccount.deleteMany(), prisma.platformAccount.deleteMany(), prisma.brokerAccount.deleteMany(), prisma.treasuryAccount.deleteMany(), prisma.wallet.deleteMany(), prisma.company.deleteMany(), prisma.userRole.deleteMany(), prisma.role.deleteMany(), prisma.user.deleteMany(),
  ]);
}
async function mkRole(key: string) { return prisma.role.create({ data: { key, name: key } }); }
async function mkUser(email: string) { return prisma.user.create({ data: { email, name: email, passwordHash: await bcrypt.hash(PASSWORD, 10), wallet: { create: {} } } }); }
async function auth(userId: string, roles: string[]) { return app.jwt.sign({ sub: userId, roles }); }

test.before(async () => { await app.ready(); await resetDb(); });
test.after(async () => { await app.close(); await prisma.$disconnect(); });

test('roles: USER bloqueado e AUDITOR liberado', async () => {
  await resetDb();
  const userRole = await mkRole('USER'); const auditorRole = await mkRole('AUDITOR');
  const u1 = await mkUser('user@ea.test'); const u2 = await mkUser('auditor@ea.test');
  await prisma.userRole.create({ data: { userId: u1.id, roleId: userRole.id } });
  await prisma.userRole.create({ data: { userId: u2.id, roleId: auditorRole.id } });
  const res403 = await app.inject({ method: 'GET', url: '/api/admin/economic-audit', headers: { authorization: `Bearer ${await auth(u1.id, ['USER'])}` } });
  assert.equal(res403.statusCode, 403);
  const res200 = await app.inject({ method: 'GET', url: '/api/admin/economic-audit/summary', headers: { authorization: `Bearer ${await auth(u2.id, ['AUDITOR'])}` } });
  assert.equal(res200.statusCode, 200);
});

test('detecta anomalias econômicas principais e endpoint summary', async () => {
  await resetDb();
  const adminRole = await mkRole('SUPER_ADMIN');
  const admin = await mkUser('admin@ea.test');
  await prisma.userRole.create({ data: { userId: admin.id, roleId: adminRole.id } });
  const founder = await mkUser('founder@ea.test');
  await prisma.wallet.update({ where: { userId: founder.id }, data: { rpcAvailableBalance: -10, rpcLockedBalance: -1, fiatAvailableBalance: -2 } });
  const company = await prisma.company.create({ data: { name: 'Comp', ticker: 'COMPX', description: 'd', sector: 's', founderUserId: founder.id, status: 'ACTIVE', totalShares: 1000, ownerSharePercent: 50, publicOfferPercent: 50, ownerShares: 500, publicOfferShares: 500, availableOfferShares: 500, initialPrice: 1, currentPrice: 1, buyFeePercent: 1, sellFeePercent: 1, fictitiousMarketCap: 1000 } });
  await prisma.companyRevenueAccount.create({ data: { companyId: company.id, balance: -4 } });
  await prisma.platformAccount.create({ data: { balance: -3 } });
  await prisma.marketOrder.create({ data: { companyId: company.id, userId: founder.id, type: 'BUY', mode: 'LIMIT', quantity: 10, remainingQuantity: 10, lockedCash: 0, status: 'OPEN', limitPrice: 1 } });
  await prisma.marketOrder.create({ data: { companyId: company.id, userId: founder.id, type: 'SELL', mode: 'LIMIT', quantity: 10, remainingQuantity: 10, lockedShares: 0, status: 'OPEN', limitPrice: 1 } });
  await prisma.trade.create({ data: { companyId: company.id, buyerId: founder.id, sellerId: founder.id, quantity: 1, unitPrice: 1, grossAmount: 1, buyFeeAmount: 0, sellFeeAmount: 0 } });
  await prisma.coinIssuance.create({ data: { createdById: '', amount: 10, reason: '', destination: 'TREASURY', previousValue: 0, newValue: 10 } });
  await prisma.coinTransfer.create({ data: { type: 'ADJUSTMENT', amount: 1, reason: '', previousValue: 0, newValue: 1 } });

  const token = await auth(admin.id, ['SUPER_ADMIN']);
  const response = await app.inject({ method: 'GET', url: '/api/admin/economic-audit?includeWarnings=true', headers: { authorization: `Bearer ${token}` } });
  assert.equal(response.statusCode, 200, response.body);
  const codes = response.json().issues.map((i: { code: string }) => i.code);
  assert.ok(codes.includes('NEGATIVE_WALLET_RPC_AVAILABLE'));
  assert.ok(codes.includes('OPEN_BUY_WITHOUT_LOCKED_CASH'));
  assert.ok(codes.includes('OPEN_SELL_WITHOUT_LOCKED_SHARES'));
  assert.ok(codes.includes('SELF_TRADE_BUYER_EQUALS_SELLER'));

  const summary = await app.inject({ method: 'GET', url: '/api/admin/economic-audit/summary', headers: { authorization: `Bearer ${token}` } });
  assert.equal(summary.statusCode, 200);
  assert.ok(summary.json().summary.total >= 4);
});
