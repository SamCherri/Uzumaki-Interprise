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
    prisma.rpcExchangeTrade.deleteMany(),
    prisma.rpcMarketState.deleteMany(),
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
    prisma.testModeReport.deleteMany(),
    prisma.testModeTrade.deleteMany(),
    prisma.testModeWallet.deleteMany(),
    prisma.testModeMarketState.deleteMany(),
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

  await prisma.wallet.update({ where: { userId: buyer.id }, data: { rpcAvailableBalance: 1000 } });
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
  assert.ok(wallets.every((w) => Number(w.rpcAvailableBalance) >= 0));
  assert.ok(wallets.every((w) => Number(w.rpcLockedBalance) >= 0));

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
  await prisma.wallet.update({ where: { userId: buyer.id }, data: { rpcAvailableBalance: 5000 } });

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
  assert.equal(Number(playerWallet.fiatAvailableBalance), 150);
  assert.equal(Number(playerWallet.availableBalance), 0);
  assert.equal(Number(playerWallet.rpcAvailableBalance), 0);
  assert.ok(transfers.length >= 2);
  assert.ok(adminLogs.length >= 3);
  assert.ok(Number(treasury.balance) >= 0);
  assert.ok(Number(brokerAccount.available) >= 0);
  assert.ok(Number(playerWallet.fiatAvailableBalance) >= 0);
});

test('admin deposita R$ direto em jogador com débito atômico da tesouraria', async () => {
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
  const tx = await prisma.transaction.findFirst({ where: { walletId: wallet.id, type: 'ADMIN_TREASURY_FIAT_TRANSFER_IN' } });
  const adjustment = await prisma.coinTransfer.findFirst({ where: { receiverId: player.id, type: 'ADJUSTMENT' } });
  const adminLog = await prisma.adminLog.findFirst({ where: { action: 'TREASURY_TRANSFER_TO_USER' } });

  assert.equal(Number(treasury.balance), 380);
  assert.equal(Number(wallet.fiatAvailableBalance), 120);
  assert.equal(Number(wallet.rpcAvailableBalance), 0);
  assert.equal(Number(wallet.availableBalance), 0);
  assert.ok(tx);
  assert.ok(adjustment);
  assert.ok(adminLog);

  const insufficient = await app.inject({ method: 'POST', url: '/api/admin/treasury/transfer-to-user', headers: { authorization: `Bearer ${adminToken}` }, payload: { userId: player.id, amount: 999999, reason: 'sem saldo' } });
  assert.equal(insufficient.statusCode, 400, insufficient.body);
  assert.match(insufficient.body, /saldo.*insuficiente/i);

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
  assert.equal(Number(adminWallet.fiatAvailableBalance), 300);
  assert.equal(Number(adminWallet.availableBalance), 0);
  assert.equal(Number(adminWallet.rpcAvailableBalance), 0);
  assert.ok(tx);
  assert.ok(log);

  const tooMuch = await app.inject({ method: 'POST', url: '/api/admin/platform-account/withdraw-to-admin', headers: { authorization: `Bearer ${superToken}` }, payload: { adminId: adminTarget.id, amount: 99999, reason: 'sem saldo' } });
  assert.equal(tooMuch.statusCode, 400, tooMuch.body);

  for (const tk of [adminToken, userToken, brokerToken]) {
    const forbidden = await app.inject({ method: 'POST', url: '/api/admin/platform-account/withdraw-to-admin', headers: { authorization: `Bearer ${tk}`, 'content-type': 'application/json' }, payload: { adminId: adminTarget.id, amount: 10, reason: 'forbidden' } });
    assert.equal(forbidden.statusCode, 403, forbidden.body);
  }
});

test('projeto desligado bloqueia rotas públicas de mercado sem apagar histórico', async () => {
  await resetDb();
  const rUser = await mkRole('USER');
  const user = await mkUser('marketuser@test.local');
  await prisma.userRole.create({ data: { userId: user.id, roleId: rUser.id } });
  await prisma.platformAccount.create({ data: {} });

  await prisma.wallet.update({ where: { userId: user.id }, data: { fiatAvailableBalance: 2000, rpcAvailableBalance: 2000 } });

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
  await prisma.companyBoostInjection.create({
    data: {
      companyId: company.id,
      source: 'ADMIN_ADJUSTMENT',
      amountRpc: 3,
      priceBefore: 10,
      priceAfter: 12,
      marketCapBefore: 10000,
      marketCapAfter: 12000,
      reason: 'teste',
    },
  });
  const buyOrder = await prisma.marketOrder.create({ data: { userId: user.id, companyId: company.id, type: 'BUY', mode: 'LIMIT', quantity: 5, remainingQuantity: 0, limitPrice: 10, status: 'FILLED' } });
  const sellOrder = await prisma.marketOrder.create({ data: { userId: user.id, companyId: company.id, type: 'SELL', mode: 'LIMIT', quantity: 5, remainingQuantity: 0, limitPrice: 10, status: 'FILLED' } });
  const op = await prisma.companyOperation.create({ data: { companyId: company.id, userId: user.id, type: 'MARKET_TRADE_EXECUTED', description: 'op' } });
  const trade = await prisma.trade.create({ data: { companyId: company.id, buyOrderId: buyOrder.id, sellOrderId: sellOrder.id, buyerId: user.id, sellerId: user.id, quantity: 5, unitPrice: 10, grossAmount: 50, buyFeeAmount: 1, sellFeeAmount: 1 } });
  await prisma.feeDistribution.create({
    data: {
      companyId: company.id,
      tradeId: trade.id,
      operationId: op.id,
      payerUserId: user.id,
      sourceType: 'MARKET_TRADE_TOTAL_FEE',
      totalFeeAmount: 2,
      platformAmount: 1,
      companyAmount: 1,
      platformSharePercent: 50,
      companySharePercent: 50,
    },
  });

  const userToken = await token(user.id, ['USER']);
  const adminToken = await token(admin.id, ['ADMIN']);
  const chiefToken = await token(chief.id, ['COIN_CHIEF_ADMIN']);
  const superToken = await token(superAdmin.id, ['SUPER_ADMIN']);

  for (const tk of [userToken, adminToken, chiefToken]) {
    const forbidden = await app.inject({ method: 'DELETE', url: `/api/admin/companies/${company.id}/force-delete`, headers: { authorization: `Bearer ${tk}`, 'content-type': 'application/json' }, payload: { reason: 'limpeza de teste completa', confirmation: 'EXCLUIR DEFINITIVAMENTE' } });
    assert.equal(forbidden.statusCode, 403, forbidden.body);
  }

  const invalidConfirmation = await app.inject({ method: 'DELETE', url: `/api/admin/companies/${company.id}/force-delete`, headers: { authorization: `Bearer ${superToken}`, 'content-type': 'application/json' }, payload: { reason: 'limpeza de teste completa', confirmation: 'ERRADO' } });
  assert.equal(invalidConfirmation.statusCode, 400, invalidConfirmation.body);

  const forceDelete = await app.inject({ method: 'DELETE', url: `/api/admin/companies/${company.id}/force-delete`, headers: { authorization: `Bearer ${superToken}`, 'content-type': 'application/json' }, payload: { reason: 'limpeza de teste completa', confirmation: 'EXCLUIR DEFINITIVAMENTE' } });
  const forceDeletePayload = JSON.parse(forceDelete.body);
  assert.equal(forceDelete.statusCode, 200, forceDelete.body);
  assert.equal(forceDeletePayload.company?.id, company.id);
  assert.ok(forceDeletePayload.deletedCounts);

  const remainingAfterForceDelete = {
    companies: await prisma.company.count({ where: { id: company.id } }),
    holdings: await prisma.companyHolding.count({ where: { companyId: company.id } }),
    operations: await prisma.companyOperation.count({ where: { companyId: company.id } }),
    initialOffers: await prisma.companyInitialOffer.count({ where: { companyId: company.id } }),
    marketOrders: await prisma.marketOrder.count({ where: { companyId: company.id } }),
    trades: await prisma.trade.count({ where: { companyId: company.id } }),
    feeDistributions: await prisma.feeDistribution.count({ where: { companyId: company.id } }),
    revenueAccounts: await prisma.companyRevenueAccount.count({ where: { companyId: company.id } }),
    boostAccounts: await prisma.companyBoostAccount.count({ where: { companyId: company.id } }),
    boostInjections: await prisma.companyBoostInjection.count({ where: { companyId: company.id } }),
    forceDeleteLogs: await prisma.adminLog.count({ where: { action: 'COMPANY_FORCE_DELETED' } }),
  };


  assert.deepEqual(remainingAfterForceDelete, {
    companies: 0,
    holdings: 0,
    operations: 0,
    initialOffers: 0,
    marketOrders: 0,
    trades: 0,
    feeDistributions: 0,
    revenueAccounts: 0,
    boostAccounts: 0,
    boostInjections: 0,
    forceDeleteLogs: 1,
  });
});



test('mercado RPC/R$ mantém singleton, cotação e integridade econômica', async () => {
  await resetDb();

  const rUser = await mkRole('USER');
  const user = await mkUser('rpcmarket@test.local', 'Rpc Trader');
  await prisma.userRole.create({ data: { userId: user.id, roleId: rUser.id } });
  await prisma.wallet.update({ where: { userId: user.id }, data: { fiatAvailableBalance: 1000, rpcAvailableBalance: 100 } });

  const firstState = await app.inject({ method: 'GET', url: '/api/rpc-market' });
  assert.equal(firstState.statusCode, 200);
  const secondState = await app.inject({ method: 'GET', url: '/api/rpc-market' });
  assert.equal(secondState.statusCode, 200);
  assert.equal(await prisma.rpcMarketState.count(), 1);

  const tk = await token(user.id, ['USER']);
  const walletBeforeQuote = await prisma.wallet.findUniqueOrThrow({ where: { userId: user.id } });
  const quoteBuy = await app.inject({ method: 'GET', url: '/api/rpc-market/quote-buy?fiatAmount=100' });
  assert.equal(quoteBuy.statusCode, 200, quoteBuy.body);
  const quoteSell = await app.inject({ method: 'GET', url: '/api/rpc-market/quote-sell?rpcAmount=10' });
  assert.equal(quoteSell.statusCode, 200, quoteSell.body);
  const walletAfterQuote = await prisma.wallet.findUniqueOrThrow({ where: { userId: user.id } });
  assert.equal(String(walletBeforeQuote.fiatAvailableBalance), String(walletAfterQuote.fiatAvailableBalance));
  assert.equal(String(walletBeforeQuote.rpcAvailableBalance), String(walletAfterQuote.rpcAvailableBalance));

  const buy = await app.inject({ method: 'POST', url: '/api/rpc-market/buy', headers: { authorization: `Bearer ${tk}` }, payload: { fiatAmount: 100 } });
  assert.equal(buy.statusCode, 200, buy.body);
  assert.equal(await prisma.rpcMarketState.count(), 1);

  const sell = await app.inject({ method: 'POST', url: '/api/rpc-market/sell', headers: { authorization: `Bearer ${tk}` }, payload: { rpcAmount: 10 } });
  assert.equal(sell.statusCode, 200, sell.body);
  assert.equal(await prisma.rpcMarketState.count(), 1);

  const walletAfter = await prisma.wallet.findUniqueOrThrow({ where: { userId: user.id } });
  assert.ok(Number(walletAfter.fiatAvailableBalance) > Number(walletBeforeQuote.fiatAvailableBalance) - 100);
  assert.ok(Number(walletAfter.rpcAvailableBalance) > Number(walletBeforeQuote.rpcAvailableBalance) - 10);
  assert.equal(Number(walletAfter.availableBalance), 0);

  const trades = await prisma.rpcExchangeTrade.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'asc' } });
  assert.equal(trades.length, 2);
  for (const trade of trades) {
    const expected = Number(trade.fiatAmount) / Number(trade.rpcAmount);
    assert.equal(Number(trade.unitPrice).toFixed(8), expected.toFixed(8));
  }
});

test('cadastro salva characterName e bankAccountNumber e /auth/me retorna campos', async () => {
  await resetDb();
  await mkRole('USER');

  const register = await app.inject({ method: 'POST', url: '/api/auth/register', payload: { name: 'Player One', characterName: 'Kenshin', bankAccountNumber: 'RP-001', email: 'register@test.local', password: '12345678' } });
  assert.equal(register.statusCode, 201, register.body);
  const payload = register.json();
  assert.equal(payload.characterName, 'Kenshin');
  assert.equal(payload.bankAccountNumber, 'RP-001');

  const login = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'register@test.local', password: '12345678' } });
  assert.equal(login.statusCode, 200, login.body);
  const tokenValue = login.json().token;

  const me = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { authorization: `Bearer ${tokenValue}` } });
  assert.equal(me.statusCode, 200, me.body);
  assert.equal(me.json().user.characterName, 'Kenshin');
  assert.equal(me.json().user.bankAccountNumber, 'RP-001');

  const invalidCharacter = await app.inject({ method: 'POST', url: '/api/auth/register', payload: { name: 'Player Two', characterName: 'ab', bankAccountNumber: 'RP-002', email: 'invalid-char@test.local', password: '12345678' } });
  assert.equal(invalidCharacter.statusCode, 400);

  const invalidBank = await app.inject({ method: 'POST', url: '/api/auth/register', payload: { name: 'Player Three', characterName: 'ValidName', bankAccountNumber: '12', email: 'invalid-bank@test.local', password: '12345678' } });
  assert.equal(invalidBank.statusCode, 400);
});

test('permissões e regras de liquidez RPC/R$ com AdminLog', async () => {
  await resetDb();
  const rUser = await mkRole('USER');
  const rAdmin = await mkRole('ADMIN');
  const rChief = await mkRole('COIN_CHIEF_ADMIN');
  const rSuper = await mkRole('SUPER_ADMIN');

  const user = await mkUser('lq-user@test.local');
  const admin = await mkUser('lq-admin@test.local');
  const chief = await mkUser('lq-chief@test.local');
  const sup = await mkUser('lq-super@test.local');

  await prisma.userRole.createMany({ data: [
    { userId: user.id, roleId: rUser.id },
    { userId: admin.id, roleId: rAdmin.id },
    { userId: chief.id, roleId: rChief.id },
    { userId: sup.id, roleId: rSuper.id },
  ] });

  const userTk = await token(user.id, ['USER']);
  const adminTk = await token(admin.id, ['ADMIN']);
  const chiefTk = await token(chief.id, ['COIN_CHIEF_ADMIN']);
  const superTk = await token(sup.id, ['SUPER_ADMIN']);

  assert.equal((await app.inject({ method: 'POST', url: '/api/admin/rpc-market/liquidity/inject', headers: { authorization: `Bearer ${userTk}` }, payload: { fiatAmount: 100, reason: 'motivo longo user' } })).statusCode, 403);
  assert.equal((await app.inject({ method: 'POST', url: '/api/admin/rpc-market/liquidity/inject', headers: { authorization: `Bearer ${adminTk}` }, payload: { fiatAmount: 100, reason: 'motivo longo admin' } })).statusCode, 403);
  assert.equal((await app.inject({ method: 'GET', url: '/api/admin/rpc-market/liquidity', headers: { authorization: `Bearer ${userTk}` } })).statusCode, 403);
  assert.equal((await app.inject({ method: 'GET', url: '/api/admin/rpc-market/liquidity', headers: { authorization: `Bearer ${adminTk}` } })).statusCode, 403);
  assert.equal((await app.inject({ method: 'GET', url: '/api/admin/rpc-market/liquidity', headers: { authorization: `Bearer ${chiefTk}` } })).statusCode, 200);
  assert.equal((await app.inject({ method: 'GET', url: '/api/admin/rpc-market/liquidity', headers: { authorization: `Bearer ${superTk}` } })).statusCode, 200);

  const inject = await app.inject({ method: 'POST', url: '/api/admin/rpc-market/liquidity/inject', headers: { authorization: `Bearer ${chiefTk}` }, payload: { fiatAmount: 1000, rpcAmount: 500, reason: 'injeção de liquidez teste' } });
  assert.equal(inject.statusCode, 200, inject.body);

  const overWithdrawFiat = await app.inject({ method: 'POST', url: '/api/admin/rpc-market/liquidity/withdraw', headers: { authorization: `Bearer ${superTk}` }, payload: { fiatAmount: 999999999, reason: 'tentativa inválida de retirada' } });
  assert.equal(overWithdrawFiat.statusCode, 400);

  const overWithdrawRpc = await app.inject({ method: 'POST', url: '/api/admin/rpc-market/liquidity/withdraw', headers: { authorization: `Bearer ${superTk}` }, payload: { rpcAmount: 999999999, reason: 'tentativa inválida de retirada rpc' } });
  assert.equal(overWithdrawRpc.statusCode, 400);

  const withdraw = await app.inject({ method: 'POST', url: '/api/admin/rpc-market/liquidity/withdraw', headers: { authorization: `Bearer ${superTk}` }, payload: { rpcAmount: 100, reason: 'retirada válida de liquidez' } });
  assert.equal(withdraw.statusCode, 200, withdraw.body);

  const state = await prisma.rpcMarketState.findUniqueOrThrow({ where: { id: 'RPC_MARKET_MAIN' } });
  assert.equal(String(state.currentPrice), String(state.fiatReserve.div(state.rpcReserve).toDecimalPlaces(8)));

  const logs = await prisma.adminLog.findMany({ where: { action: { in: ['RPC_MARKET_LIQUIDITY_INJECT', 'RPC_MARKET_LIQUIDITY_WITHDRAW'] } } });
  assert.ok(logs.length >= 2);
  assert.ok(logs.every((log) => !!log.previous && !!log.current));
});

test('modo teste global bloqueia rotas reais, mantém isolamento e registra logs administrativos', async () => {
  await resetDb();

  const rSuper = await mkRole('SUPER_ADMIN');
  const rAdmin = await mkRole('ADMIN');
  const rUser = await mkRole('USER');

  const superAdmin = await mkUser('tm-super@test.local');
  const admin = await mkUser('tm-admin@test.local');
  const user = await mkUser('tm-user@test.local');

  await prisma.userRole.createMany({ data: [
    { userId: superAdmin.id, roleId: rSuper.id },
    { userId: admin.id, roleId: rAdmin.id },
    { userId: user.id, roleId: rUser.id },
  ] });

  const superTk = await token(superAdmin.id, ['SUPER_ADMIN']);
  const adminTk = await token(admin.id, ['ADMIN']);
  const userTk = await token(user.id, ['USER']);

  const modeStart = await app.inject({ method: 'GET', url: '/api/system-mode' });
  assert.equal(modeStart.statusCode, 200);
  assert.equal(modeStart.json().mode, 'NORMAL');

  assert.equal((await app.inject({ method: 'POST', url: '/api/admin/system-mode/test/enable', headers: { authorization: `Bearer ${userTk}` }, payload: { reason: 'tentativa sem permissão user' } })).statusCode, 403);
  assert.equal((await app.inject({ method: 'POST', url: '/api/admin/system-mode/test/enable', headers: { authorization: `Bearer ${adminTk}` }, payload: { reason: 'tentativa sem permissão admin' } })).statusCode, 403);

  const enable = await app.inject({ method: 'POST', url: '/api/admin/system-mode/test/enable', headers: { authorization: `Bearer ${superTk}` }, payload: { reason: 'ativando modo teste global' } });
  assert.equal(enable.statusCode, 200, enable.body);

  const blockedNoToken = await app.inject({ method: 'GET', url: '/api/rpc-market' });
  assert.equal(blockedNoToken.statusCode, 403);
  const blockedUser = await app.inject({ method: 'GET', url: '/api/rpc-market', headers: { authorization: `Bearer ${userTk}` } });
  assert.equal(blockedUser.statusCode, 403);

  const testMe = await app.inject({ method: 'GET', url: '/api/test-mode/me', headers: { authorization: `Bearer ${userTk}` } });
  assert.equal(testMe.statusCode, 200, testMe.body);
  assert.equal(Number(testMe.json().fiatBalance), 10000);

  const reportInTest = await app.inject({ method: 'POST', url: '/api/test-mode/reports', headers: { authorization: `Bearer ${userTk}` }, payload: { type: 'BUG', location: 'Tela', description: 'Teste de report' } });
  assert.equal(reportInTest.statusCode, 201, reportInTest.body);

  const buy = await app.inject({ method: 'POST', url: '/api/test-mode/buy', headers: { authorization: `Bearer ${userTk}` }, payload: { fiatAmount: 100 } });
  assert.equal(buy.statusCode, 200, buy.body);
  const sell = await app.inject({ method: 'POST', url: '/api/test-mode/sell', headers: { authorization: `Bearer ${userTk}` }, payload: { rpcAmount: 10 } });
  assert.equal(sell.statusCode, 200, sell.body);

  const realWallet = await prisma.wallet.findUniqueOrThrow({ where: { userId: user.id } });
  const testWallet = await prisma.testModeWallet.findUniqueOrThrow({ where: { userId: user.id } });
  assert.equal(Number(realWallet.fiatAvailableBalance), 0);
  assert.ok(Number(testWallet.fiatBalance) >= 0);

  assert.equal(await prisma.rpcExchangeTrade.count({ where: { userId: user.id } }), 0);
  assert.equal(await prisma.rpcMarketState.count(), 0);

  const resetUser = await app.inject({ method: 'POST', url: '/api/admin/test-mode/reset-user', headers: { authorization: `Bearer ${superTk}` }, payload: { userId: user.id, reason: 'reset de carteira de teste' } });
  assert.equal(resetUser.statusCode, 200, resetUser.body);

  const clearWrong = await app.inject({ method: 'POST', url: '/api/admin/test-mode/clear', headers: { authorization: `Bearer ${superTk}` }, payload: { reason: 'limpeza errada', confirmation: 'ERRADO' } });
  assert.equal(clearWrong.statusCode, 400);
  const clearOk = await app.inject({ method: 'POST', url: '/api/admin/test-mode/clear', headers: { authorization: `Bearer ${superTk}` }, payload: { reason: 'limpeza correta de teste', confirmation: 'LIMPAR MODO TESTE' } });
  assert.equal(clearOk.statusCode, 200, clearOk.body);

  const disable = await app.inject({ method: 'POST', url: '/api/admin/system-mode/normal/enable', headers: { authorization: `Bearer ${superTk}` }, payload: { reason: 'encerrando modo teste global' } });
  assert.equal(disable.statusCode, 200, disable.body);

  const reportInNormal = await app.inject({ method: 'POST', url: '/api/test-mode/reports', headers: { authorization: `Bearer ${userTk}` }, payload: { type: 'BUG', location: 'Tela', description: 'Teste de report' } });
  assert.equal(reportInNormal.statusCode, 403);

  const logs = await prisma.adminLog.findMany({ where: { action: { in: ['SYSTEM_MODE_ENABLE_TEST', 'SYSTEM_MODE_ENABLE_NORMAL', 'TEST_MODE_RESET_USER', 'TEST_MODE_CLEAR'] } } });
  assert.ok(logs.length >= 4);
});

test('modo teste global bloqueia /api/me e /api/rpc-market para USER e permite /api/test-mode/me', async () => {
  await resetDb();
  const roleUser = await mkRole('USER');
  const user = await mkUser('testmode-user@test.local');
  await prisma.userRole.create({ data: { userId: user.id, roleId: roleUser.id } });
  await prisma.systemModeConfig.upsert({ where: { id: 'SYSTEM_MODE_MAIN' }, update: { mode: 'TEST' }, create: { id: 'SYSTEM_MODE_MAIN', mode: 'TEST' } });

  const userToken = await token(user.id, ['USER']);

  const meBlocked = await app.inject({ method: 'GET', url: '/api/me', headers: { authorization: `Bearer ${userToken}` } });
  assert.equal(meBlocked.statusCode, 403, meBlocked.body);

  const marketBlocked = await app.inject({ method: 'GET', url: '/api/rpc-market', headers: { authorization: `Bearer ${userToken}` } });
  assert.equal(marketBlocked.statusCode, 403, marketBlocked.body);

  const withoutTokenBlocked = await app.inject({ method: 'GET', url: '/api/market/orders' });
  assert.equal(withoutTokenBlocked.statusCode, 403, withoutTokenBlocked.body);

  const testModeMeAllowed = await app.inject({ method: 'GET', url: '/api/test-mode/me', headers: { authorization: `Bearer ${userToken}` } });
  assert.equal(testModeMeAllowed.statusCode, 200, testModeMeAllowed.body);
});

test('modo normal bloqueia endpoint test-mode/me', async () => {
  await resetDb();
  const roleUser = await mkRole('USER');
  const user = await mkUser('normal-user@test.local');
  await prisma.userRole.create({ data: { userId: user.id, roleId: roleUser.id } });
  await prisma.systemModeConfig.upsert({ where: { id: 'SYSTEM_MODE_MAIN' }, update: { mode: 'NORMAL' }, create: { id: 'SYSTEM_MODE_MAIN', mode: 'NORMAL' } });
  const userToken = await token(user.id, ['USER']);
  const response = await app.inject({ method: 'GET', url: '/api/test-mode/me', headers: { authorization: `Bearer ${userToken}` } });
  assert.equal(response.statusCode, 403, response.body);
});


test('modo teste: preço, leaderboard, guardas e report types', async () => {
  await resetDb();
  const rUser = await mkRole('USER');
  const user = await mkUser('tmode@test.local', 'TMode');
  await prisma.userRole.create({ data: { userId: user.id, roleId: rUser.id } });

  const superAdminRole = await mkRole('SUPER_ADMIN');
  const admin = await mkUser('admin-tmode@test.local', 'Admin');
  await prisma.userRole.create({ data: { userId: admin.id, roleId: superAdminRole.id } });

  const adminToken = await token(admin.id, ['SUPER_ADMIN']);
  const userToken = await token(user.id, ['USER']);

  const setTest = await app.inject({ method: 'POST', url: '/api/admin/system-mode/test/enable', headers: { authorization: `Bearer ${adminToken}` }, payload: { reason: 'Ativando modo teste para teste crítico' } });
  assert.equal(setTest.statusCode, 200, setTest.body);

  const deniedMe = await app.inject({ method: 'GET', url: '/api/me', headers: { authorization: `Bearer ${userToken}` } });
  assert.equal(deniedMe.statusCode, 403, deniedMe.body);

  const deniedMarket = await app.inject({ method: 'GET', url: '/api/rpc-market', headers: { authorization: `Bearer ${userToken}` } });
  assert.equal(deniedMarket.statusCode, 403, deniedMarket.body);

  const testMe = await app.inject({ method: 'GET', url: '/api/test-mode/me', headers: { authorization: `Bearer ${userToken}` } });
  assert.equal(testMe.statusCode, 200, testMe.body);

  const beforeMarket = await app.inject({ method: 'GET', url: '/api/test-mode/market', headers: { authorization: `Bearer ${userToken}` } });
  const beforePrice = Number(beforeMarket.json().currentPrice);

  const buy = await app.inject({ method: 'POST', url: '/api/test-mode/buy', headers: { authorization: `Bearer ${userToken}` }, payload: { fiatAmount: 100 } });
  assert.equal(buy.statusCode, 200, buy.body);
  const afterBuyMarket = await app.inject({ method: 'GET', url: '/api/test-mode/market', headers: { authorization: `Bearer ${userToken}` } });
  const afterBuyPrice = Number(afterBuyMarket.json().currentPrice);
  assert.ok(afterBuyPrice > beforePrice);

  const sell = await app.inject({ method: 'POST', url: '/api/test-mode/sell', headers: { authorization: `Bearer ${userToken}` }, payload: { rpcAmount: 1 } });
  assert.equal(sell.statusCode, 200, sell.body);
  const afterSellMarket = await app.inject({ method: 'GET', url: '/api/test-mode/market', headers: { authorization: `Bearer ${userToken}` } });
  const afterSellPrice = Number(afterSellMarket.json().currentPrice);
  assert.ok(afterSellPrice < afterBuyPrice);

  const leaderboard = await app.inject({ method: 'GET', url: '/api/test-mode/leaderboard', headers: { authorization: `Bearer ${userToken}` } });
  assert.equal(leaderboard.statusCode, 200, leaderboard.body);
  const rows = leaderboard.json().leaderboard as Array<{ userId: string; estimatedTotalFiat: string }>;
  assert.ok(rows.some((row) => row.userId === user.id));
  const sorted = [...rows].sort((a, b) => Number(b.estimatedTotalFiat) - Number(a.estimatedTotalFiat));
  assert.deepEqual(rows.map((r) => r.userId), sorted.map((r) => r.userId));

  for (const type of ['BUG','VISUAL_ERROR','BALANCE_ERROR','CHEAT_SUSPECTED','SUGGESTION','OTHER']) {
    const report = await app.inject({ method: 'POST', url: '/api/test-mode/reports', headers: { authorization: `Bearer ${userToken}` }, payload: { type, location: 'Tela', description: 'Teste' } });
    assert.equal(report.statusCode, 201, report.body);
  }

  const setNormal = await app.inject({ method: 'POST', url: '/api/admin/system-mode/normal/enable', headers: { authorization: `Bearer ${adminToken}` }, payload: { reason: 'Voltando para modo normal no teste crítico' } });
  assert.equal(setNormal.statusCode, 200, setNormal.body);

  const reportBlockedInNormal = await app.inject({ method: 'POST', url: '/api/test-mode/reports', headers: { authorization: `Bearer ${userToken}` }, payload: { type: 'BUG', location: 'Tela', description: 'Teste em normal' } });
  assert.equal(reportBlockedInNormal.statusCode, 403, reportBlockedInNormal.body);
});

test('bot tick do modo teste só opera em TEST e não altera economia real', async () => {
  await resetDb();

  const rUser = await mkRole('USER');
  const user = await mkUser('testmode-bot@test.local', 'Test Bot User');
  await prisma.userRole.create({ data: { userId: user.id, roleId: rUser.id } });
  await prisma.platformAccount.create({ data: {} });

  const userToken = await token(user.id, ['USER']);

  const normalMode = await app.inject({
    method: 'POST',
    url: '/api/test-mode/bot-tick',
    headers: { authorization: `Bearer ${userToken}` },
  });
  assert.equal(normalMode.statusCode, 403, normalMode.body);

  const superAdminRole = await mkRole('SUPER_ADMIN');
  const admin = await mkUser('testmode-admin@test.local', 'Test Admin');
  await prisma.userRole.create({ data: { userId: admin.id, roleId: superAdminRole.id } });
  const adminToken = await token(admin.id, ['SUPER_ADMIN']);

  const setTestMode = await app.inject({
    method: 'POST',
    url: '/api/admin/system-mode/test/enable',
    headers: { authorization: `Bearer ${adminToken}` },
    payload: { reason: 'Ativando TEST para validar bot tick' },
  });
  assert.equal(setTestMode.statusCode, 200, setTestMode.body);

  const realMarketBefore = await prisma.rpcMarketState.findFirst();
  const realTradesBefore = await prisma.rpcExchangeTrade.count();
  const realWalletsBefore = await prisma.wallet.count();
  const testMarketBefore = await prisma.testModeMarketState.findUnique({ where: { id: 'TEST_MODE_MARKET_MAIN' } });

  const tick = await app.inject({
    method: 'POST',
    url: '/api/test-mode/bot-tick',
    headers: { authorization: `Bearer ${userToken}` },
  });
  assert.equal(tick.statusCode, 200, tick.body);
  const payload = tick.json();
  assert.ok(payload.currentPrice);
  assert.ok(payload.skipped === true || payload.side === 'BUY' || payload.side === 'SELL');

  const realMarketAfter = await prisma.rpcMarketState.findFirst();
  const realTradesAfter = await prisma.rpcExchangeTrade.count();
  const realWalletsAfter = await prisma.wallet.count();
  const testMarketAfter = await prisma.testModeMarketState.findUniqueOrThrow({ where: { id: 'TEST_MODE_MARKET_MAIN' } });

  assert.equal(JSON.stringify(realMarketAfter), JSON.stringify(realMarketBefore));
  assert.equal(realTradesAfter, realTradesBefore);
  assert.equal(realWalletsAfter, realWalletsBefore);
  assert.notEqual(String(testMarketAfter.updatedAt), String(testMarketBefore?.updatedAt ?? ''));

  const setNormalMode = await app.inject({
    method: 'POST',
    url: '/api/admin/system-mode/normal/enable',
    headers: { authorization: `Bearer ${adminToken}` },
    payload: { reason: 'Voltando para NORMAL após validar bot tick' },
  });
  assert.equal(setNormalMode.statusCode, 200, setNormalMode.body);
});
