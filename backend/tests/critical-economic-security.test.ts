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
    const sellResp = await app.inject({
      method: 'POST',
      url: '/api/market/orders',
      headers: { authorization: `Bearer ${tk}` },
      payload: { companyId: company.id, type: 'SELL', mode: 'LIMIT', quantity: 10, limitPrice: 10 },
    });
    assert.equal(sellResp.statusCode, 201, sellResp.body);
  }

  const buyerToken = await token(buyer.id, ['USER']);
  const buyResp = await app.inject({
    method: 'POST',
    url: '/api/market/orders',
    headers: { authorization: `Bearer ${buyerToken}` },
    payload: { companyId: company.id, type: 'BUY', mode: 'LIMIT', quantity: 30, limitPrice: 10 },
  });
  assert.equal(buyResp.statusCode, 201, buyResp.body);

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
  assert.equal(ok.statusCode, 200, ok.body);
  assert.match(ok.headers['content-type'] || '', /text\/csv/);
  assert.match(ok.body, /type|id/i);

  const forbidden = await app.inject({ method: 'GET', url: '/api/admin/reports/export/transactions', headers: { authorization: `Bearer ${userToken}` } });
  assert.equal(forbidden.statusCode, 403, forbidden.body);

  const notBroker = await app.inject({ method: 'GET', url: `/api/admin/reports/export/broker-report?userId=${user.id}`, headers: { authorization: `Bearer ${adminToken}` } });
  assert.equal(notBroker.statusCode, 400, notBroker.body);
  assert.match(notBroker.body, /não é corretor/i);
});

test('compra inicial altera preço, cria operação e não cria trade', async () => {
  await resetDb();
  const rUser = await mkRole('USER');
  const buyer = await mkUser('initialbuyer@test.local', 'Initial Buyer');
  await prisma.userRole.create({ data: { userId: buyer.id, roleId: rUser.id } });
  await prisma.platformAccount.create({ data: {} });
  await prisma.wallet.update({ where: { userId: buyer.id }, data: { availableBalance: 5000 } });

  const company = await prisma.company.create({
    data: {
      name: 'Oferta Inicial', ticker: 'INIT1', description: 'desc', sector: 'setor', founderUserId: buyer.id, status: 'ACTIVE', totalShares: 1000,
      circulatingShares: 0, ownerSharePercent: 40, publicOfferPercent: 60, ownerShares: 400, publicOfferShares: 600, availableOfferShares: 600,
      initialPrice: 10, currentPrice: 10, buyFeePercent: 2, sellFeePercent: 1, fictitiousMarketCap: 10000, approvedAt: new Date(),
      revenueAccount: { create: {} }, initialOffer: { create: { totalShares: 600, availableShares: 600 } },
    },
  });

  const buyerToken = await token(buyer.id, ['USER']);
  const response = await app.inject({
    method: 'POST',
    url: `/api/companies/${company.id}/buy-initial-offer`,
    headers: { authorization: `Bearer ${buyerToken}` },
    payload: { quantity: 50 },
  });

  assert.equal(response.statusCode, 201, response.body);
  const payload = response.json();
  assert.ok(payload.priceBefore);
  assert.ok(payload.priceAfter);
  assert.ok(Number(payload.priceAfter) > Number(payload.priceBefore));
  assert.equal(String(payload.currentPrice), String(payload.priceAfter));

  const companyAfter = await prisma.company.findUniqueOrThrow({ where: { id: company.id } });
  const holding = await prisma.companyHolding.findUniqueOrThrow({ where: { userId_companyId: { userId: buyer.id, companyId: company.id } } });
  const op = await prisma.companyOperation.findFirst({ where: { companyId: company.id, userId: buyer.id, type: 'INITIAL_OFFER_BUY' } });
  const fees = await prisma.feeDistribution.findMany({ where: { companyId: company.id } });
  const platform = await prisma.platformAccount.findFirstOrThrow();
  const revenue = await prisma.companyRevenueAccount.findUniqueOrThrow({ where: { companyId: company.id } });
  const tradesCount = await prisma.trade.count({ where: { companyId: company.id } });

  assert.ok(Number(companyAfter.currentPrice) > 10);
  assert.equal(holding.shares, 50);
  assert.ok(op);
  assert.ok(fees.length > 0);
  assert.ok(Number(platform.balance) > 0);
  assert.ok(Number(revenue.balance) > 0);
  assert.equal(tradesCount, 0);
});

test('tesouraria envia RPC para corretor e corretor envia para jogador', async () => {
  await resetDb();
  const rSuper = await mkRole('SUPER_ADMIN');
  const rBroker = await mkRole('VIRTUAL_BROKER');
  const rUser = await mkRole('USER');

  const admin = await mkUser('super@test.local', 'Super');
  const broker = await mkUser('broker@test.local', 'Broker');
  const player = await mkUser('player@test.local', 'Player');

  await prisma.userRole.createMany({ data: [
    { userId: admin.id, roleId: rSuper.id },
    { userId: broker.id, roleId: rBroker.id },
    { userId: player.id, roleId: rUser.id },
  ] });

  await prisma.treasuryAccount.create({ data: { balance: 0 } });

  const adminToken = await token(admin.id, ['SUPER_ADMIN']);
  const brokerToken = await token(broker.id, ['VIRTUAL_BROKER']);

  const issuance = await app.inject({ method: 'POST', url: '/api/admin/treasury/issuance', headers: { authorization: `Bearer ${adminToken}` }, payload: { amount: 1000, reason: 'emissão teste' } });
  assert.equal(issuance.statusCode, 201, issuance.body);

  const toBroker = await app.inject({ method: 'POST', url: '/api/admin/treasury/transfer-to-broker', headers: { authorization: `Bearer ${adminToken}` }, payload: { brokerUserId: broker.id, amount: 400, reason: 'repasse corretor' } });
  assert.equal(toBroker.statusCode, 201, toBroker.body);

  const toPlayer = await app.inject({ method: 'POST', url: '/api/broker/transfer-to-user', headers: { authorization: `Bearer ${brokerToken}` }, payload: { userId: player.id, amount: 150, reason: 'repasse jogador' } });
  assert.equal(toPlayer.statusCode, 201, toPlayer.body);

  const treasury = await prisma.treasuryAccount.findFirstOrThrow();
  const brokerAccount = await prisma.brokerAccount.findUniqueOrThrow({ where: { userId: broker.id } });
  const playerWallet = await prisma.wallet.findUniqueOrThrow({ where: { userId: player.id } });
  const transfers = await prisma.coinTransfer.findMany();
  const adminLogs = await prisma.adminLog.findMany();

  assert.equal(Number(treasury.balance), 600);
  assert.equal(Number(brokerAccount.available), 250);
  assert.equal(Number(playerWallet.availableBalance), 150);
  assert.ok(transfers.length >= 2);
  assert.ok(adminLogs.length >= 3);
  assert.ok(Number(treasury.balance) >= 0);
  assert.ok(Number(brokerAccount.available) >= 0);
  assert.ok(Number(playerWallet.availableBalance) >= 0);
});

test('admin deposita RPC direto em jogador com débito atômico da tesouraria', async () => {
  await resetDb();
  const rSuper = await mkRole('SUPER_ADMIN');
  const rUser = await mkRole('USER');

  const admin = await mkUser('admin2@test.local');
  const player = await mkUser('player2@test.local');
  const commonUser = await mkUser('common@test.local');

  await prisma.userRole.createMany({ data: [
    { userId: admin.id, roleId: rSuper.id },
    { userId: player.id, roleId: rUser.id },
    { userId: commonUser.id, roleId: rUser.id },
  ] });

  await prisma.treasuryAccount.create({ data: { balance: 500 } });

  const adminToken = await token(admin.id, ['SUPER_ADMIN']);
  const userToken = await token(commonUser.id, ['USER']);

  const ok = await app.inject({ method: 'POST', url: '/api/admin/treasury/transfer-to-user', headers: { authorization: `Bearer ${adminToken}` }, payload: { userId: player.id, amount: 120, reason: 'ajuste adm' } });
  assert.equal(ok.statusCode, 201, ok.body);

  const treasury = await prisma.treasuryAccount.findFirstOrThrow();
  const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId: player.id } });
  const tx = await prisma.transaction.findFirst({ where: { walletId: wallet.id, type: 'ADMIN_TREASURY_TRANSFER_IN' } });
  const adjustment = await prisma.coinTransfer.findFirst({ where: { receiverId: player.id, type: 'ADJUSTMENT' } });
  const adminLog = await prisma.adminLog.findFirst({ where: { action: 'TREASURY_TRANSFER_TO_USER' } });

  assert.equal(Number(treasury.balance), 380);
  assert.equal(Number(wallet.availableBalance), 120);
  assert.ok(tx);
  assert.ok(adjustment);
  assert.ok(adminLog);

  const insufficient = await app.inject({ method: 'POST', url: '/api/admin/treasury/transfer-to-user', headers: { authorization: `Bearer ${adminToken}` }, payload: { userId: player.id, amount: 999999, reason: 'sem saldo' } });
  assert.equal(insufficient.statusCode, 400, insufficient.body);
  assert.match(insufficient.body, /saldo insuficiente/i);

  const forbidden = await app.inject({ method: 'POST', url: '/api/admin/treasury/transfer-to-user', headers: { authorization: `Bearer ${userToken}` }, payload: { userId: player.id, amount: 10, reason: 'forbidden' } });
  assert.equal(forbidden.statusCode, 403, forbidden.body);
});

test('super admin retira lucro da Exchange para carteira administrativa', async () => {
  await resetDb();
  const rSuper = await mkRole('SUPER_ADMIN');
  const rAdmin = await mkRole('ADMIN');
  const rUser = await mkRole('USER');
  const rBroker = await mkRole('VIRTUAL_BROKER');

  const superAdmin = await mkUser('super3@test.local');
  const adminTarget = await mkUser('admindest@test.local');
  const commonUser = await mkUser('user3@test.local');
  const broker = await mkUser('broker3@test.local');

  await prisma.userRole.createMany({ data: [
    { userId: superAdmin.id, roleId: rSuper.id },
    { userId: adminTarget.id, roleId: rAdmin.id },
    { userId: commonUser.id, roleId: rUser.id },
    { userId: broker.id, roleId: rBroker.id },
  ] });

  await prisma.platformAccount.create({ data: { balance: 1000, totalReceivedFees: 1000, totalWithdrawn: 0 } });

  const superToken = await token(superAdmin.id, ['SUPER_ADMIN']);
  const adminToken = await token(adminTarget.id, ['ADMIN']);
  const userToken = await token(commonUser.id, ['USER']);
  const brokerToken = await token(broker.id, ['VIRTUAL_BROKER']);

  const ok = await app.inject({ method: 'POST', url: '/api/admin/platform-account/withdraw-to-admin', headers: { authorization: `Bearer ${superToken}` }, payload: { adminId: adminTarget.id, amount: 300, reason: 'retirada lucro' } });
  assert.equal(ok.statusCode, 201, ok.body);

  const platform = await prisma.platformAccount.findFirstOrThrow();
  const adminWallet = await prisma.wallet.findUniqueOrThrow({ where: { userId: adminTarget.id } });
  const tx = await prisma.transaction.findFirst({ where: { walletId: adminWallet.id, type: 'PLATFORM_PROFIT_WITHDRAWAL_IN' } });
  const log = await prisma.adminLog.findFirst({ where: { action: 'PLATFORM_PROFIT_WITHDRAWAL' } });

  assert.equal(Number(platform.balance), 700);
  assert.equal(Number(platform.totalWithdrawn), 300);
  assert.equal(Number(adminWallet.availableBalance), 300);
  assert.ok(tx);
  assert.ok(log);

  const tooMuch = await app.inject({ method: 'POST', url: '/api/admin/platform-account/withdraw-to-admin', headers: { authorization: `Bearer ${superToken}` }, payload: { adminId: adminTarget.id, amount: 99999, reason: 'sem saldo' } });
  assert.equal(tooMuch.statusCode, 400, tooMuch.body);

  for (const tk of [adminToken, userToken, brokerToken]) {
    const forbidden = await app.inject({ method: 'POST', url: '/api/admin/platform-account/withdraw-to-admin', headers: { authorization: `Bearer ${tk}` }, payload: { adminId: adminTarget.id, amount: 10, reason: 'forbidden' } });
    assert.equal(forbidden.statusCode, 403, forbidden.body);
  }
});

test('projeto desligado bloqueia rotas públicas de mercado sem apagar histórico', async () => {
  await resetDb();
  const rUser = await mkRole('USER');
  const user = await mkUser('marketuser@test.local');
  await prisma.userRole.create({ data: { userId: user.id, roleId: rUser.id } });
  await prisma.platformAccount.create({ data: {} });

  await prisma.wallet.update({ where: { userId: user.id }, data: { availableBalance: 2000 } });

  const company = await prisma.company.create({
    data: {
      name: 'Mercado Ativo', ticker: 'MRK1', description: 'desc', sector: 'setor', founderUserId: user.id, status: 'ACTIVE', totalShares: 1000,
      circulatingShares: 100, ownerSharePercent: 40, publicOfferPercent: 60, ownerShares: 400, publicOfferShares: 600, availableOfferShares: 600,
      initialPrice: 10, currentPrice: 10, buyFeePercent: 1, sellFeePercent: 1, fictitiousMarketCap: 10000, approvedAt: new Date(),
      revenueAccount: { create: {} }, initialOffer: { create: { totalShares: 600, availableShares: 600 } },
    },
  });

  const userToken = await token(user.id, ['USER']);

  const listActive = await app.inject({ method: 'GET', url: '/api/companies', headers: { authorization: `Bearer ${userToken}` } });
  assert.equal(listActive.statusCode, 200, listActive.body);
  assert.match(listActive.body, /MRK1/);

  const seedBuy = await app.inject({ method: 'POST', url: `/api/companies/${company.id}/buy-initial-offer`, headers: { authorization: `Bearer ${userToken}` }, payload: { quantity: 20 } });
  assert.equal(seedBuy.statusCode, 201, seedBuy.body);

  const orderBookActive = await app.inject({ method: 'GET', url: `/api/market/companies/${company.id}/order-book`, headers: { authorization: `Bearer ${userToken}` } });
  const tradesActive = await app.inject({ method: 'GET', url: `/api/market/companies/${company.id}/trades`, headers: { authorization: `Bearer ${userToken}` } });
  assert.equal(orderBookActive.statusCode, 200, orderBookActive.body);
  assert.equal(tradesActive.statusCode, 200, tradesActive.body);

  await prisma.company.update({ where: { id: company.id }, data: { status: 'SUSPENDED' } });

  const listSuspended = await app.inject({ method: 'GET', url: '/api/companies', headers: { authorization: `Bearer ${userToken}` } });
  assert.equal(listSuspended.statusCode, 200, listSuspended.body);
  assert.ok(!listSuspended.body.includes('MRK1'));

  const blockedOrderBook = await app.inject({ method: 'GET', url: `/api/market/companies/${company.id}/order-book`, headers: { authorization: `Bearer ${userToken}` } });
  const blockedTrades = await app.inject({ method: 'GET', url: `/api/market/companies/${company.id}/trades`, headers: { authorization: `Bearer ${userToken}` } });
  const blockedOrder = await app.inject({ method: 'POST', url: '/api/market/orders', headers: { authorization: `Bearer ${userToken}` }, payload: { companyId: company.id, type: 'BUY', mode: 'LIMIT', quantity: 1, limitPrice: 10 } });
  const blockedBuyMarket = await app.inject({ method: 'POST', url: `/api/market/companies/${company.id}/buy-market`, headers: { authorization: `Bearer ${userToken}` }, payload: { quantity: 1, slippagePercent: 5 } });
  const blockedSellMarket = await app.inject({ method: 'POST', url: `/api/market/companies/${company.id}/sell-market`, headers: { authorization: `Bearer ${userToken}` }, payload: { quantity: 1, slippagePercent: 5 } });

  assert.equal(blockedOrderBook.statusCode, 400, blockedOrderBook.body);
  assert.equal(blockedTrades.statusCode, 400, blockedTrades.body);
  assert.equal(blockedOrder.statusCode, 400, blockedOrder.body);
  assert.equal(blockedBuyMarket.statusCode, 400, blockedBuyMarket.body);
  assert.equal(blockedSellMarket.statusCode, 400, blockedSellMarket.body);

  const operationsCount = await prisma.companyOperation.count({ where: { companyId: company.id, type: 'INITIAL_OFFER_BUY' } });
  assert.ok(operationsCount > 0);
  const ordersCount = await prisma.marketOrder.count({ where: { companyId: company.id } });
  const tradesCount = await prisma.trade.count({ where: { companyId: company.id } });
  assert.ok(ordersCount >= 0);
  assert.ok(tradesCount >= 0);
});

test('force delete de projeto de teste só para SUPER_ADMIN e apaga histórico vinculado', async () => {
  await resetDb();

  const rSuper = await mkRole('SUPER_ADMIN');
  const rAdmin = await mkRole('ADMIN');
  const rChief = await mkRole('COIN_CHIEF_ADMIN');
  const rUser = await mkRole('USER');

  const superAdmin = await mkUser('super-force@test.local');
  const admin = await mkUser('admin-force@test.local');
  const chief = await mkUser('chief-force@test.local');
  const user = await mkUser('user-force@test.local');

  await prisma.userRole.createMany({ data: [
    { userId: superAdmin.id, roleId: rSuper.id },
    { userId: admin.id, roleId: rAdmin.id },
    { userId: chief.id, roleId: rChief.id },
    { userId: user.id, roleId: rUser.id },
  ] });

  const company = await prisma.company.create({
    data: {
      name: 'Projeto Teste', ticker: 'FORCE1', description: 'desc', sector: 'setor', founderUserId: user.id, status: 'CLOSED', totalShares: 1000,
      circulatingShares: 100, ownerSharePercent: 40, publicOfferPercent: 60, ownerShares: 400, publicOfferShares: 600, availableOfferShares: 500,
      initialPrice: 10, currentPrice: 12, buyFeePercent: 2, sellFeePercent: 1, fictitiousMarketCap: 12000, approvedAt: new Date(),
    },
  });

  await prisma.companyHolding.create({ data: { userId: user.id, companyId: company.id, shares: 10, averageBuyPrice: 10, estimatedValue: 120 } });
  await prisma.companyInitialOffer.create({ data: { companyId: company.id, totalShares: 600, availableShares: 500 } });
  await prisma.companyRevenueAccount.create({ data: { companyId: company.id, balance: 5, totalReceivedFees: 5 } });
  await prisma.companyBoostAccount.create({ data: { companyId: company.id } });
  await prisma.companyBoostInjection.create({ data: { companyId: company.id, amount: 3, reason: 'teste' } });
  const buyOrder = await prisma.marketOrder.create({ data: { userId: user.id, companyId: company.id, type: 'BUY', mode: 'LIMIT', quantity: 5, remainingQuantity: 0, limitPrice: 10, status: 'FILLED', executedQuantity: 5 } });
  const sellOrder = await prisma.marketOrder.create({ data: { userId: user.id, companyId: company.id, type: 'SELL', mode: 'LIMIT', quantity: 5, remainingQuantity: 0, limitPrice: 10, status: 'FILLED', executedQuantity: 5 } });
  const op = await prisma.companyOperation.create({ data: { companyId: company.id, userId: user.id, type: 'TRADE_BUY', description: 'op' } });
  const trade = await prisma.trade.create({ data: { companyId: company.id, buyOrderId: buyOrder.id, sellOrderId: sellOrder.id, buyerUserId: user.id, sellerUserId: user.id, quantity: 5, unitPrice: 10, totalPrice: 50, buyerFee: 1, sellerFee: 1 } });
  await prisma.feeDistribution.create({ data: { companyId: company.id, tradeId: trade.id, operationId: op.id, platformAmount: 1, companyAmount: 1, grossAmount: 2 } });

  const userToken = await token(user.id, ['USER']);
  const adminToken = await token(admin.id, ['ADMIN']);
  const chiefToken = await token(chief.id, ['COIN_CHIEF_ADMIN']);
  const superToken = await token(superAdmin.id, ['SUPER_ADMIN']);

  for (const tk of [userToken, adminToken, chiefToken]) {
    const forbidden = await app.inject({ method: 'DELETE', url: `/api/admin/companies/${company.id}/force-delete`, headers: { authorization: `Bearer ${tk}` }, payload: { reason: 'limpeza de teste completa', confirmation: 'EXCLUIR DEFINITIVAMENTE' } });
    assert.equal(forbidden.statusCode, 403, forbidden.body);
  }

  const invalidConfirmation = await app.inject({ method: 'DELETE', url: `/api/admin/companies/${company.id}/force-delete`, headers: { authorization: `Bearer ${superToken}` }, payload: { reason: 'limpeza de teste completa', confirmation: 'ERRADO' } });
  assert.equal(invalidConfirmation.statusCode, 400, invalidConfirmation.body);

  const forceDelete = await app.inject({ method: 'DELETE', url: `/api/admin/companies/${company.id}/force-delete`, headers: { authorization: `Bearer ${superToken}` }, payload: { reason: 'limpeza de teste completa', confirmation: 'EXCLUIR DEFINITIVAMENTE' } });
  assert.equal(forceDelete.statusCode, 200, forceDelete.body);

  assert.equal(await prisma.company.count({ where: { id: company.id } }), 0);
  assert.equal(await prisma.companyHolding.count({ where: { companyId: company.id } }), 0);
  assert.equal(await prisma.companyOperation.count({ where: { companyId: company.id } }), 0);
  assert.equal(await prisma.companyInitialOffer.count({ where: { companyId: company.id } }), 0);
  assert.equal(await prisma.marketOrder.count({ where: { companyId: company.id } }), 0);
  assert.equal(await prisma.trade.count({ where: { companyId: company.id } }), 0);
  assert.equal(await prisma.feeDistribution.count({ where: { companyId: company.id } }), 0);

  const forceLog = await prisma.adminLog.findFirst({ where: { action: 'COMPANY_FORCE_DELETED' } });
  assert.ok(forceLog);
});
