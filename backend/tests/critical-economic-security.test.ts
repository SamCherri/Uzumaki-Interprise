import test from 'node:test';
import assert from 'node:assert/strict';

if (process.env.NODE_ENV === 'production') throw new Error('Testes não podem rodar em produção.');
if (!process.env.TEST_DATABASE_URL) throw new Error('TEST_DATABASE_URL é obrigatório para testes de integração.');
if ((process.env.DATABASE_URL || '').includes('railway') && !process.env.TEST_DATABASE_URL) throw new Error('Recusado: sem TEST_DATABASE_URL isolado.');
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

const [{ buildApp }, { prisma }] = await Promise.all([
  import('../src/app.js'),
  import('../src/lib/prisma.js'),
]);

const app = buildApp();

async function resetDb() {
  await prisma.$transaction([
    prisma.feeDistribution.deleteMany(),
    prisma.trade.deleteMany(),
    prisma.marketOrder.deleteMany(),
    prisma.companyOperation.deleteMany(),
    prisma.companyHolding.deleteMany(),
    prisma.companyInitialOffer.deleteMany(),
    prisma.companyRevenueAccount.deleteMany(),
    prisma.companyBoostInjection.deleteMany(),
    prisma.companyBoostAccount.deleteMany(),
    prisma.company.deleteMany(),
    prisma.coinTransfer.deleteMany(),
    prisma.coinIssuance.deleteMany(),
    prisma.transaction.deleteMany(),
    prisma.withdrawalRequest.deleteMany(),
    prisma.adminLog.deleteMany(),
    prisma.brokerAccount.deleteMany(),
    prisma.wallet.deleteMany(),
    prisma.userRole.deleteMany(),
    prisma.rolePermission.deleteMany(),
    prisma.permission.deleteMany(),
    prisma.role.deleteMany(),
    prisma.user.deleteMany(),
    prisma.platformAccount.deleteMany(),
    prisma.treasuryAccount.deleteMany(),
  ]);
}

async function mkUser(email: string, name = 'User') {
  return prisma.user.create({ data: { email, name, passwordHash: 'hash', wallet: { create: {} } } });
}

async function mkRole(key: string) {
  return prisma.role.create({ data: { key, name: key } });
}

async function token(userId: string, roles: string[]) {
  return app.jwt.sign({ sub: userId, roles });
}

test.before(async () => {
  await app.ready();
  await resetDb();
});

test.after(async () => {
  await app.close();
  await prisma.$disconnect();
});

test('matching multi-fill mantém saldos, locks e taxa', async () => {
  await resetDb();

  const rUser = await mkRole('USER');
  const buyer = await mkUser('buyer@test.local', 'Buyer');
  const sellers = await Promise.all([mkUser('s1@test.local'), mkUser('s2@test.local'), mkUser('s3@test.local')]);

  for (const u of [buyer, ...sellers]) {
    await prisma.userRole.create({ data: { userId: u.id, roleId: rUser.id } });
  }

  await prisma.platformAccount.create({ data: {} });

  await prisma.wallet.update({ where: { userId: buyer.id }, data: { availableBalance: 1000 } });
  const company = await prisma.company.create({
    data: {
      name: 'Comp',
      ticker: 'CMP1',
      description: 'd',
      sector: 's',
      founderUserId: buyer.id,
      status: 'ACTIVE',
      totalShares: 1000,
      circulatingShares: 300,
      ownerSharePercent: 40,
      publicOfferPercent: 60,
      ownerShares: 400,
      publicOfferShares: 600,
      availableOfferShares: 300,
      initialPrice: 10,
      currentPrice: 10,
      buyFeePercent: 1,
      sellFeePercent: 1,
      fictitiousMarketCap: 10000,
      approvedAt: new Date(),
      revenueAccount: { create: {} },
    },
  });

  for (const s of sellers) {
    await prisma.companyHolding.create({
      data: { userId: s.id, companyId: company.id, shares: 100, averageBuyPrice: 10, estimatedValue: 1000 },
    });
  }

  for (const s of sellers) {
    const tk = await token(s.id, ['USER']);
    await app.inject({
      method: 'POST',
      url: '/api/market/orders',
      headers: { authorization: `Bearer ${tk}` },
      payload: { companyId: company.id, type: 'SELL', mode: 'LIMIT', quantity: 10, limitPrice: 10 },
    });
  }

  const buyerToken = await token(buyer.id, ['USER']);
  const buyResp = await app.inject({
    method: 'POST',
    url: '/api/market/orders',
    headers: { authorization: `Bearer ${buyerToken}` },
    payload: { companyId: company.id, type: 'BUY', mode: 'LIMIT', quantity: 30, limitPrice: 10 },
  });
  assert.equal(buyResp.statusCode, 201);

  const trades = await prisma.trade.findMany({ where: { companyId: company.id }, orderBy: { createdAt: 'asc' } });
  assert.equal(trades.length, 3);

  const buyOrder = await prisma.marketOrder.findFirstOrThrow({ where: { companyId: company.id, userId: buyer.id, type: 'BUY' } });
  assert.ok(['FILLED', 'PARTIALLY_FILLED'].includes(buyOrder.status));

  const sellerOrders = await prisma.marketOrder.findMany({ where: { companyId: company.id, type: 'SELL' } });
  assert.ok(sellerOrders.every((o) => o.status === 'FILLED'));

  const buyerHolding = await prisma.companyHolding.findUniqueOrThrow({ where: { userId_companyId: { userId: buyer.id, companyId: company.id } } });
  assert.equal(buyerHolding.shares, 30);

  const companyAfter = await prisma.company.findUniqueOrThrow({ where: { id: company.id } });
  assert.equal(String(companyAfter.currentPrice), String(trades[trades.length - 1].unitPrice));

  const wallets = await prisma.wallet.findMany();
  assert.ok(wallets.every((w) => Number(w.availableBalance) >= 0));
  assert.ok(wallets.every((w) => Number(w.lockedBalance) >= 0));

  const allOrders = await prisma.marketOrder.findMany();
  assert.ok(allOrders.every((o) => Number(o.lockedCash) >= 0));
  assert.ok(allOrders.every((o) => Number(o.lockedShares) >= 0));

  const fees = await prisma.feeDistribution.findMany({ where: { companyId: company.id } });
  assert.ok(fees.length > 0);

  const platform = await prisma.platformAccount.findFirstOrThrow();
  const revenue = await prisma.companyRevenueAccount.findUniqueOrThrow({ where: { companyId: company.id } });
  assert.ok(Number(platform.balance) > 0);
  assert.ok(Number(revenue.balance) > 0);
});

test('export csv exige admin e broker-report valida corretor', async () => {
  await resetDb();

  const rAdmin = await mkRole('ADMIN');
  const rUser = await mkRole('USER');
  const admin = await mkUser('admin@test.local');
  const user = await mkUser('user@test.local');

  await prisma.userRole.createMany({ data: [{ userId: admin.id, roleId: rAdmin.id }, { userId: user.id, roleId: rUser.id }] });

  const adminToken = await token(admin.id, ['ADMIN']);
  const userToken = await token(user.id, ['USER']);

  const ok = await app.inject({ method: 'GET', url: '/api/admin/reports/export/transactions', headers: { authorization: `Bearer ${adminToken}` } });
  assert.equal(ok.statusCode, 200);
  assert.match(ok.headers['content-type'] || '', /text\/csv/);
  assert.match(ok.body, /type|id/i);

  const forbidden = await app.inject({ method: 'GET', url: '/api/admin/reports/export/transactions', headers: { authorization: `Bearer ${userToken}` } });
  assert.equal(forbidden.statusCode, 403);

  const notBroker = await app.inject({ method: 'GET', url: `/api/admin/reports/export/broker-report?userId=${user.id}`, headers: { authorization: `Bearer ${adminToken}` } });
  assert.equal(notBroker.statusCode, 400);
  assert.match(notBroker.body, /não é corretor/i);
});
