import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';

type AuthRequest = FastifyRequest & { user: { roles?: string[] } };

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

function checkAdmin(reply: FastifyReply, request: FastifyRequest) {
  const roles = (request as AuthRequest).user.roles ?? [];
  const allowed = ['ADMIN', 'SUPER_ADMIN', 'COIN_CHIEF_ADMIN'].some((role) => roles.includes(role));
  if (!allowed) {
    reply.code(403).send({ message: 'Sem permissão para auditoria administrativa.' });
    return false;
  }
  return true;
}

function dateRange(from?: string, to?: string) {
  const createdAt: { gte?: Date; lte?: Date } = {};
  if (from) createdAt.gte = new Date(from);
  if (to) createdAt.lte = new Date(to);
  return Object.keys(createdAt).length > 0 ? createdAt : undefined;
}

export async function adminAuditRoutes(app: FastifyInstance) {
  app.get('/audit/logs', { preHandler: [app.authenticate] }, async (request, reply) => {
    if (!checkAdmin(reply, request)) return;
    const query = z.object({ action: z.string().optional(), entity: z.string().optional(), userId: z.string().optional(), search: z.string().optional(), from: z.string().optional(), to: z.string().optional() }).merge(paginationSchema).parse(request.query);
    const where = {
      ...(query.action ? { action: query.action } : {}), ...(query.entity ? { entity: query.entity } : {}), ...(query.userId ? { userId: query.userId } : {}),
      ...(query.search ? { OR: [{ reason: { contains: query.search, mode: 'insensitive' as const } }, { action: { contains: query.search, mode: 'insensitive' as const } }, { entity: { contains: query.search, mode: 'insensitive' as const } }] } : {}),
      ...(dateRange(query.from, query.to) ? { createdAt: dateRange(query.from, query.to) } : {}),
    };
    const [total, items] = await Promise.all([prisma.adminLog.count({ where }), prisma.adminLog.findMany({ where, include: { user: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: 'desc' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })]);
    return { items, pagination: { page: query.page, pageSize: query.pageSize, total } };
  });

  app.get('/audit/transactions', { preHandler: [app.authenticate] }, async (request, reply) => {
    if (!checkAdmin(reply, request)) return;
    const query = z.object({ userId: z.string().optional(), walletId: z.string().optional(), type: z.string().optional(), search: z.string().optional(), from: z.string().optional(), to: z.string().optional() }).merge(paginationSchema).parse(request.query);
    const where: {
      walletId?: string | { in: string[] };
      type?: string;
      description?: { contains: string; mode: 'insensitive' };
      createdAt?: { gte?: Date; lte?: Date };
    } = {
      ...(query.walletId ? { walletId: query.walletId } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.search ? { description: { contains: query.search, mode: 'insensitive' as const } } : {}),
      ...(dateRange(query.from, query.to) ? { createdAt: dateRange(query.from, query.to) } : {}),
    };

    if (query.userId) {
      const walletsFromUser = await prisma.wallet.findMany({
        where: { userId: query.userId },
        select: { id: true },
      });

      const walletIdsFromUser = walletsFromUser.map((wallet: { id: string }) => wallet.id);

      if (walletIdsFromUser.length === 0) {
        return { items: [], pagination: { page: query.page, pageSize: query.pageSize, total: 0 } };
      }

      if (query.walletId) {
        if (!walletIdsFromUser.includes(query.walletId)) {
          return { items: [], pagination: { page: query.page, pageSize: query.pageSize, total: 0 } };
        }
      } else {
        where.walletId = { in: walletIdsFromUser };
      }
    }

    const [total, items] = await Promise.all([
      prisma.transaction.count({ where }),
      prisma.transaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    const walletIds = [...new Set(items.map((item: { walletId: string }) => item.walletId))];
    const wallets = await prisma.wallet.findMany({
      where: { id: { in: walletIds } },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    const walletMap = new Map(wallets.map((wallet: { id: string }) => [wallet.id, wallet] as const));

    return {
      items: items.map((item: { walletId: string }) => ({ ...item, wallet: walletMap.get(item.walletId) ?? null })),
      pagination: { page: query.page, pageSize: query.pageSize, total },
    };
  });

  app.get('/audit/transfers', { preHandler: [app.authenticate] }, async (request, reply) => {
    if (!checkAdmin(reply, request)) return;
    const query = z.object({ type: z.enum(['ISSUANCE_TO_TREASURY','TREASURY_TO_BROKER','BROKER_TO_USER','USER_TRADE','ADJUSTMENT']).optional(), senderId: z.string().optional(), receiverId: z.string().optional(), search: z.string().optional(), from: z.string().optional(), to: z.string().optional() }).merge(paginationSchema).parse(request.query);
    const where = { ...(query.type ? { type: query.type } : {}), ...(query.senderId ? { senderId: query.senderId } : {}), ...(query.receiverId ? { receiverId: query.receiverId } : {}), ...(query.search ? { reason: { contains: query.search, mode: 'insensitive' as const } } : {}), ...(dateRange(query.from, query.to) ? { createdAt: dateRange(query.from, query.to) } : {}) };
    const [total, items] = await Promise.all([prisma.coinTransfer.count({ where }), prisma.coinTransfer.findMany({ where, include: { sender: { select: { id: true, name: true, email: true } }, receiver: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: 'desc' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })]);
    return { items, pagination: { page: query.page, pageSize: query.pageSize, total } };
  });

  app.get('/audit/withdrawals', { preHandler: [app.authenticate] }, async (request, reply) => {
    if (!checkAdmin(reply, request)) return;
    const query = z.object({ status: z.enum(['PENDING','PROCESSING','COMPLETED','REJECTED','CANCELED']).optional(), userId: z.string().optional(), code: z.string().optional(), search: z.string().optional(), from: z.string().optional(), to: z.string().optional() }).merge(paginationSchema).parse(request.query);
    const where = { ...(query.status ? { status: query.status } : {}), ...(query.userId ? { userId: query.userId } : {}), ...(query.code ? { code: { contains: query.code, mode: 'insensitive' as const } } : {}), ...(query.search ? { OR: [{ adminNote: { contains: query.search, mode: 'insensitive' as const } }, { userNote: { contains: query.search, mode: 'insensitive' as const } }] } : {}), ...(dateRange(query.from, query.to) ? { createdAt: dateRange(query.from, query.to) } : {}) };
    const [total, items] = await Promise.all([prisma.withdrawalRequest.count({ where }), prisma.withdrawalRequest.findMany({ where, include: { user: { select: { id: true, name: true, email: true } }, reviewedBy: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: 'desc' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })]);
    return { items, pagination: { page: query.page, pageSize: query.pageSize, total } };
  });

  app.get('/audit/orders', { preHandler: [app.authenticate] }, async (request, reply) => { /* similar */
    if (!checkAdmin(reply, request)) return;
    const query = z.object({ status: z.enum(['OPEN','PARTIALLY_FILLED','FILLED','CANCELED','REJECTED']).optional(), type: z.enum(['BUY','SELL']).optional(), mode: z.enum(['LIMIT','MARKET']).optional(), companyId: z.string().optional(), userId: z.string().optional(), search: z.string().optional(), from: z.string().optional(), to: z.string().optional() }).merge(paginationSchema).parse(request.query);
    const where = { ...(query.status ? { status: query.status } : {}), ...(query.type ? { type: query.type } : {}), ...(query.mode ? { mode: query.mode } : {}), ...(query.companyId ? { companyId: query.companyId } : {}), ...(query.userId ? { userId: query.userId } : {}), ...(query.search ? { OR: [{ user: { name: { contains: query.search, mode: 'insensitive' as const } } }, { company: { name: { contains: query.search, mode: 'insensitive' as const } } }, { company: { ticker: { contains: query.search, mode: 'insensitive' as const } } }] } : {}), ...(dateRange(query.from, query.to) ? { createdAt: dateRange(query.from, query.to) } : {}) };
    const [total, items] = await Promise.all([prisma.marketOrder.count({ where }), prisma.marketOrder.findMany({ where, include: { user: { select: { id: true, name: true, email: true } }, company: { select: { id: true, name: true, ticker: true } } }, orderBy: { createdAt: 'desc' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })]);
    return { items, pagination: { page: query.page, pageSize: query.pageSize, total } };
  });

  app.get('/audit/trades', { preHandler: [app.authenticate] }, async (request, reply) => {
    if (!checkAdmin(reply, request)) return;
    const query = z.object({ companyId: z.string().optional(), buyerId: z.string().optional(), sellerId: z.string().optional(), search: z.string().optional(), from: z.string().optional(), to: z.string().optional() }).merge(paginationSchema).parse(request.query);
    const where = { ...(query.companyId ? { companyId: query.companyId } : {}), ...(query.buyerId ? { buyerId: query.buyerId } : {}), ...(query.sellerId ? { sellerId: query.sellerId } : {}), ...(query.search ? { OR: [{ buyer: { name: { contains: query.search, mode: 'insensitive' as const } } }, { seller: { name: { contains: query.search, mode: 'insensitive' as const } } }, { company: { ticker: { contains: query.search, mode: 'insensitive' as const } } }] } : {}), ...(dateRange(query.from, query.to) ? { createdAt: dateRange(query.from, query.to) } : {}) };
    const [total, items] = await Promise.all([prisma.trade.count({ where }), prisma.trade.findMany({ where, include: { company: { select: { id: true, ticker: true, name: true } }, buyer: { select: { id: true, name: true, email: true } }, seller: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: 'desc' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })]);
    return { items, pagination: { page: query.page, pageSize: query.pageSize, total } };
  });



  app.get('/reports/users/:userId', { preHandler: [app.authenticate] }, async (request, reply) => {
    if (!checkAdmin(reply, request)) return;

    const params = z.object({ userId: z.string().min(1) }).parse(request.params);
    const query = z.object({ from: z.string().optional(), to: z.string().optional() }).parse(request.query);
    const range = dateRange(query.from, query.to);

    const user = await prisma.user.findUnique({
      where: { id: params.userId },
      select: {
        id: true,
        name: true,
        email: true,
        isBlocked: true,
        roles: { select: { role: { select: { key: true } } } },
      },
    });

    if (!user) {
      return reply.code(404).send({ message: 'Usuário não encontrado.' });
    }

    const wallet = await prisma.wallet.findUnique({ where: { userId: params.userId } });

    const transactionsWhere = {
      ...(wallet ? { walletId: wallet.id } : { walletId: '__NO_WALLET__' }),
      ...(range ? { createdAt: range } : {}),
    };
    const transfersInWhere = { receiverId: params.userId, ...(range ? { createdAt: range } : {}) };
    const transfersOutWhere = { senderId: params.userId, ...(range ? { createdAt: range } : {}) };
    const transfersWhere = { OR: [{ senderId: params.userId }, { receiverId: params.userId }], ...(range ? { createdAt: range } : {}) };
    const withdrawalsWhere = { userId: params.userId, ...(range ? { createdAt: range } : {}) };
    const ordersWhere = { userId: params.userId, ...(range ? { createdAt: range } : {}) };
    const holdingsWhere = { userId: params.userId };

    const [
      transactionsCount,
      recentTransactions,
      transferredIn,
      transferredOut,
      withdrawalsPending,
      withdrawalsCompleted,
      recentTransfers,
      recentWithdrawals,
      openOrders,
      filledOrders,
      recentOrders,
      holdingsCount,
      holdings,
    ] = await Promise.all([
      prisma.transaction.count({ where: transactionsWhere }),
      prisma.transaction.findMany({ where: transactionsWhere, orderBy: { createdAt: 'desc' }, take: 10 }),
      prisma.coinTransfer.aggregate({ where: transfersInWhere, _sum: { amount: true } }),
      prisma.coinTransfer.aggregate({ where: transfersOutWhere, _sum: { amount: true } }),
      prisma.withdrawalRequest.aggregate({ where: { ...withdrawalsWhere, status: 'PENDING' }, _sum: { amount: true } }),
      prisma.withdrawalRequest.aggregate({ where: { ...withdrawalsWhere, status: 'COMPLETED' }, _sum: { amount: true } }),
      prisma.coinTransfer.findMany({ where: transfersWhere, include: { sender: { select: { id: true, name: true, email: true } }, receiver: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: 'desc' }, take: 10 }),
      prisma.withdrawalRequest.findMany({ where: withdrawalsWhere, orderBy: { createdAt: 'desc' }, take: 10 }),
      prisma.marketOrder.count({ where: { ...ordersWhere, status: { in: ['OPEN', 'PARTIALLY_FILLED'] } } }),
      prisma.marketOrder.count({ where: { ...ordersWhere, status: 'FILLED' } }),
      prisma.marketOrder.findMany({ where: ordersWhere, include: { company: { select: { id: true, name: true, ticker: true, status: true } } }, orderBy: { createdAt: 'desc' }, take: 10 }),
      prisma.companyHolding.count({ where: holdingsWhere }),
      prisma.companyHolding.findMany({ where: holdingsWhere, include: { company: { select: { id: true, name: true, ticker: true, status: true, currentPrice: true } } }, orderBy: { updatedAt: 'desc' } }),
    ]);

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        isBlocked: user.isBlocked,
        roles: user.roles.map((item: { role: { key: string } }) => item.role.key),
      },
      wallet: {
        availableBalance: wallet?.availableBalance ?? 0,
        lockedBalance: wallet?.lockedBalance ?? 0,
        pendingWithdrawalBalance: wallet?.pendingWithdrawalBalance ?? 0,
      },
      summary: {
        transactionsCount,
        transferredIn: transferredIn._sum.amount ?? 0,
        transferredOut: transferredOut._sum.amount ?? 0,
        withdrawalsPending: withdrawalsPending._sum.amount ?? 0,
        withdrawalsCompleted: withdrawalsCompleted._sum.amount ?? 0,
        openOrders,
        filledOrders,
        holdingsCount,
      },
      recentTransactions,
      recentTransfers,
      recentWithdrawals,
      recentOrders,
      holdings,
    };
  });

  app.get('/reports/brokers/:userId', { preHandler: [app.authenticate] }, async (request, reply) => {
    if (!checkAdmin(reply, request)) return;

    const params = z.object({ userId: z.string().min(1) }).parse(request.params);
    const query = z.object({ from: z.string().optional(), to: z.string().optional() }).parse(request.query);
    const range = dateRange(query.from, query.to);

    const user = await prisma.user.findUnique({
      where: { id: params.userId },
      select: {
        id: true,
        name: true,
        email: true,
        roles: { select: { role: { select: { key: true } } } },
      },
    });

    if (!user) {
      return reply.code(404).send({ message: 'Usuário não encontrado.' });
    }

    const userRoles = user.roles.map((item: { role: { key: string } }) => item.role.key);
    if (!userRoles.includes('VIRTUAL_BROKER')) {
      return reply.code(400).send({ message: 'Usuário não é corretor.' });
    }

    const brokerAccount = await prisma.brokerAccount.findUnique({ where: { userId: params.userId } });
    const brokerTransfersToUsersWhere = { senderId: params.userId, type: 'BROKER_TO_USER' as const, ...(range ? { createdAt: range } : {}) };
    const treasuryToBrokerWhere = { receiverId: params.userId, type: 'TREASURY_TO_BROKER' as const, ...(range ? { createdAt: range } : {}) };
    const brokerTransfersWhere = { OR: [{ senderId: params.userId }, { receiverId: params.userId }], ...(range ? { createdAt: range } : {}) };

    const [receivedFromTreasury, sentToUsers, transfersToUsersCount, usersServedDistinct, lastTransfer, recentTransfers] = await Promise.all([
      prisma.coinTransfer.aggregate({ where: treasuryToBrokerWhere, _sum: { amount: true } }),
      prisma.coinTransfer.aggregate({ where: brokerTransfersToUsersWhere, _sum: { amount: true } }),
      prisma.coinTransfer.count({ where: brokerTransfersToUsersWhere }),
      prisma.coinTransfer.findMany({ where: brokerTransfersToUsersWhere, select: { receiverId: true }, distinct: ['receiverId'] }),
      prisma.coinTransfer.findFirst({ where: brokerTransfersWhere, orderBy: { createdAt: 'desc' } }),
      prisma.coinTransfer.findMany({ where: brokerTransfersWhere, include: { sender: { select: { id: true, name: true, email: true } }, receiver: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: 'desc' }, take: 20 }),
    ]);

    return {
      broker: {
        id: user.id,
        name: user.name,
        email: user.email,
        roles: userRoles,
      },
      brokerAccount: {
        availableBalance: brokerAccount?.available ?? 0,
        receivedTotal: brokerAccount?.receivedTotal ?? 0,
        transferredTotal: Number(brokerAccount?.receivedTotal ?? 0) - Number(brokerAccount?.available ?? 0),
      },
      summary: {
        receivedFromTreasury: receivedFromTreasury._sum.amount ?? 0,
        sentToUsers: sentToUsers._sum.amount ?? 0,
        transfersToUsersCount,
        usersServedCount: usersServedDistinct.filter((item: { receiverId: string | null }) => item.receiverId).length,
        lastTransferAt: lastTransfer?.createdAt ?? null,
      },
      recentTransfers,
    };
  });
  app.get('/reports/overview', { preHandler: [app.authenticate] }, async (request, reply) => {
    if (!checkAdmin(reply, request)) return;
    const [users, brokers, active, suspended, closed, wallets, treasury, platform, pendingWithdrawals, openOrders, traded, companyFees] = await Promise.all([
      prisma.user.count(), prisma.user.count({ where: { roles: { some: { role: { key: 'VIRTUAL_BROKER' } } } } }), prisma.company.count({ where: { status: 'ACTIVE' } }), prisma.company.count({ where: { status: 'SUSPENDED' } }), prisma.company.count({ where: { status: 'CLOSED' } }), prisma.wallet.aggregate({ _sum: { availableBalance: true, lockedBalance: true, pendingWithdrawalBalance: true } }), prisma.treasuryAccount.findFirst(), prisma.platformAccount.findFirst(), prisma.withdrawalRequest.count({ where: { status: 'PENDING' } }), prisma.marketOrder.count({ where: { status: { in: ['OPEN', 'PARTIALLY_FILLED'] } } }), prisma.trade.aggregate({ _sum: { grossAmount: true } }), prisma.companyRevenueAccount.aggregate({ _sum: { totalReceivedFees: true } }),
    ]);
    return { totalUsers: users, totalBrokers: brokers, totalTokensActive: active, totalTokensSuspended: suspended, totalTokensClosed: closed, totalWalletAvailable: wallets._sum.availableBalance ?? 0, totalWalletLocked: wallets._sum.lockedBalance ?? 0, totalPendingWithdrawalsBalance: wallets._sum.pendingWithdrawalBalance ?? 0, treasuryBalance: treasury?.balance ?? 0, platformBalance: platform?.balance ?? 0, totalPlatformReceivedFees: platform?.totalReceivedFees ?? 0, totalProjectReceivedFees: companyFees._sum.totalReceivedFees ?? 0, pendingWithdrawalsCount: pendingWithdrawals, openOrdersCount: openOrders, totalTradedVolume: traded._sum.grossAmount ?? 0 };
  });

  app.get('/reports/company-revenues', { preHandler: [app.authenticate] }, async (request, reply) => {
    if (!checkAdmin(reply, request)) return;
    const items = await prisma.companyRevenueAccount.findMany({ include: { company: { include: { founder: { select: { id: true, name: true, email: true } } } } }, orderBy: { updatedAt: 'desc' } });
    return { items: items.map((item: { companyId: string; company: { name: string; ticker: string; founder: { id: string; name: string | null; email: string } | null; status: string; currentPrice: unknown }; balance: unknown; totalReceivedFees: unknown; totalWithdrawn: unknown }) => ({ companyId: item.companyId, token: item.company.name, ticker: item.company.ticker, owner: item.company.founder, balance: item.balance, totalReceivedFees: item.totalReceivedFees, totalWithdrawn: item.totalWithdrawn, status: item.company.status, currentPrice: item.company.currentPrice })) };
  });

  app.get('/reports/platform-account', { preHandler: [app.authenticate] }, async (request, reply) => {
    if (!checkAdmin(reply, request)) return;
    const item = await prisma.platformAccount.findFirst();
    return { balance: item?.balance ?? 0, totalReceivedFees: item?.totalReceivedFees ?? 0, totalWithdrawn: item?.totalWithdrawn ?? 0, createdAt: item?.createdAt ?? null, updatedAt: item?.updatedAt ?? null };
  });
}
