import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';

type AuthRequest = FastifyRequest & { user: { sub: string; roles?: string[] } };

const amountSchema = z.coerce.number().positive();

function requireRole(reply: FastifyReply, roles: string[], accepted: string[], message: string) {
  const allowed = accepted.some((role) => roles.includes(role));

  if (!allowed) {
    reply.code(403).send({ message });
    return false;
  }

  return true;
}

export async function adminRoutes(app: FastifyInstance) {
  app.get('/admin/overview', { preHandler: [app.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const authRequest = request as AuthRequest;
    const roles = authRequest.user.roles ?? [];
    const isAdmin = roles.includes('ADMIN') || roles.includes('SUPER_ADMIN');

    if (!isAdmin) {
      return reply.code(403).send({ message: 'Sem permissão para o painel admin.' });
    }

    const [users, companies, logs, treasury] = await Promise.all([
      prisma.user.count(),
      prisma.company.count(),
      prisma.adminLog.count(),
      prisma.treasuryAccount.findFirst(),
    ]);

    return {
      users,
      companies,
      logs,
      treasuryBalance: treasury?.balance ?? 0,
    };
  });

  app.get('/admin/treasury/balance', { preHandler: [app.authenticate] }, async (request, reply) => {
    const authRequest = request as AuthRequest;
    const roles = authRequest.user.roles ?? [];

    if (!requireRole(reply, roles, ['ADMIN', 'SUPER_ADMIN', 'COIN_CHIEF_ADMIN'], 'Sem permissão para consultar tesouraria.')) {
      return;
    }

    const treasury = await prisma.treasuryAccount.findFirstOrThrow();
    return { balance: treasury.balance };
  });

  app.post('/admin/treasury/issuance', { preHandler: [app.authenticate] }, async (request, reply) => {
    const authRequest = request as AuthRequest;
    const roles = authRequest.user.roles ?? [];

    if (!requireRole(reply, roles, ['COIN_CHIEF_ADMIN', 'SUPER_ADMIN'], 'Somente ADM Chefe da Moeda pode emitir moeda.')) {
      return;
    }

    try {
      const schema = z.object({
        amount: amountSchema,
        reason: z.string().min(3),
      });
      const body = schema.parse(request.body);

      const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const treasury = await tx.treasuryAccount.findFirstOrThrow();
      const amount = new Decimal(body.amount);
      const previous = treasury.balance;
      const next = treasury.balance.add(amount);

      const issuance = await tx.coinIssuance.create({
        data: {
          createdById: authRequest.user.sub,
          amount,
          reason: body.reason,
          destination: 'TREASURY',
          previousValue: previous,
          newValue: next,
        },
      });

      await tx.treasuryAccount.update({
        where: { id: treasury.id },
        data: { balance: next },
      });

      await tx.adminLog.create({
        data: {
          userId: authRequest.user.sub,
          action: 'COIN_ISSUANCE',
          entity: 'TreasuryAccount',
          reason: body.reason,
          previous: JSON.stringify({ treasuryBalance: previous.toString() }),
          current: JSON.stringify({ treasuryBalance: next.toString(), amount: amount.toString() }),
          ip: request.ip,
          userAgent: request.headers['user-agent'] ?? null,
        },
      });

      return { issuance, treasuryBalance: next };
      });

      return reply.code(201).send(result);
    } catch (error) {
      return reply.code(400).send({ message: (error as Error).message });
    }
  });

  app.post('/admin/treasury/transfer-to-broker', { preHandler: [app.authenticate] }, async (request, reply) => {
    const authRequest = request as AuthRequest;
    const roles = authRequest.user.roles ?? [];

    if (!requireRole(reply, roles, ['ADMIN', 'SUPER_ADMIN', 'COIN_CHIEF_ADMIN'], 'Sem permissão para enviar moeda a corretor.')) {
      return;
    }

    try {
      const schema = z.object({
        brokerUserId: z.string().min(1).optional(),
        brokerEmail: z.string().email().optional(),
        amount: amountSchema,
        reason: z.string().min(3),
      }).superRefine((value, ctx) => {
        if (!value.brokerEmail && !value.brokerUserId) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Informe o e-mail do corretor.',
            path: ['brokerEmail'],
          });
        }
      });
      const body = schema.parse(request.body);

      const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const treasury = await tx.treasuryAccount.findFirstOrThrow();
      const amount = new Decimal(body.amount);

      if (treasury.balance.lessThan(amount)) {
        throw new Error('Saldo insuficiente na tesouraria.');
      }

      const brokerUser = await tx.user.findFirst({
        where: {
          ...(body.brokerEmail ? { email: body.brokerEmail } : { id: body.brokerUserId }),
          roles: { some: { role: { key: 'VIRTUAL_BROKER' } } },
        },
      });

      if (!brokerUser) {
        if (body.brokerEmail) {
          const userByEmail = await tx.user.findUnique({ where: { email: body.brokerEmail } });
          if (!userByEmail) {
            throw new Error('Não existe usuário cadastrado com esse e-mail.');
          }
        }
        throw new Error('Usuário de destino não possui cargo de corretor virtual.');
      }

      const broker = await tx.brokerAccount.upsert({
        where: { userId: brokerUser.id },
        update: {},
        create: {
          userId: brokerUser.id,
          available: 0,
          receivedTotal: 0,
        },
      });

      const treasuryPrevious = treasury.balance;
      const treasuryNext = treasury.balance.sub(amount);
      const brokerPrevious = broker.available;
      const brokerNext = broker.available.add(amount);

      const transfer = await tx.coinTransfer.create({
        data: {
          type: 'TREASURY_TO_BROKER',
          senderId: null,
          receiverId: brokerUser.id,
          amount,
          reason: body.reason,
          previousValue: treasuryPrevious,
          newValue: treasuryNext,
        },
      });

      await tx.treasuryAccount.update({ where: { id: treasury.id }, data: { balance: treasuryNext } });
      await tx.brokerAccount.update({
        where: { id: broker.id },
        data: {
          available: brokerNext,
          receivedTotal: broker.receivedTotal.add(amount),
        },
      });

      await tx.adminLog.create({
        data: {
          userId: authRequest.user.sub,
          action: 'TREASURY_TRANSFER_TO_BROKER',
          entity: 'BrokerAccount',
          reason: body.reason,
          previous: JSON.stringify({ treasuryBalance: treasuryPrevious.toString(), brokerAvailable: brokerPrevious.toString() }),
          current: JSON.stringify({ treasuryBalance: treasuryNext.toString(), brokerAvailable: brokerNext.toString(), amount: amount.toString() }),
          ip: request.ip,
          userAgent: request.headers['user-agent'] ?? null,
        },
      });

      return { transfer, treasuryBalance: treasuryNext, brokerBalance: brokerNext };
    });

    return reply.code(201).send(result);
    } catch (error) {
      return reply.code(400).send({ message: (error as Error).message });
    }
  });


  app.get('/admin/platform-account', { preHandler: [app.authenticate] }, async (request, reply) => {
    const authRequest = request as AuthRequest;
    const roles = authRequest.user.roles ?? [];

    if (!requireRole(reply, roles, ['ADMIN', 'SUPER_ADMIN', 'COIN_CHIEF_ADMIN', 'AUDITOR'], 'Sem permissão para consultar receita da plataforma.')) {
      return;
    }

    const platform = await prisma.platformAccount.findFirst();

    return {
      balance: platform?.balance ?? new Decimal(0),
      totalReceivedFees: platform?.totalReceivedFees ?? new Decimal(0),
    };
  });

  app.get('/admin/company-revenue-accounts', { preHandler: [app.authenticate] }, async (request, reply) => {
    const authRequest = request as AuthRequest;
    const roles = authRequest.user.roles ?? [];

    if (!requireRole(reply, roles, ['ADMIN', 'SUPER_ADMIN', 'COIN_CHIEF_ADMIN', 'AUDITOR'], 'Sem permissão para consultar receitas das empresas.')) {
      return;
    }

    const accounts = await prisma.companyRevenueAccount.findMany({
      include: {
        company: {
          select: {
            id: true,
            ticker: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      accounts: accounts.map((account) => ({
        companyId: account.companyId,
        ticker: account.company.ticker,
        companyName: account.company.name,
        balance: account.balance,
        totalReceivedFees: account.totalReceivedFees,
        totalWithdrawn: account.totalWithdrawn,
      })),
    };
  });

  app.get('/admin/coin-history', { preHandler: [app.authenticate] }, async (request, reply) => {
    const authRequest = request as AuthRequest;
    const roles = authRequest.user.roles ?? [];

    if (!requireRole(reply, roles, ['ADMIN', 'SUPER_ADMIN', 'COIN_CHIEF_ADMIN', 'AUDITOR'], 'Sem permissão para histórico da moeda.')) {
      return;
    }

    const [issuances, transfers] = await Promise.all([
      prisma.coinIssuance.findMany({ orderBy: { createdAt: 'desc' }, take: 50 }),
      prisma.coinTransfer.findMany({ orderBy: { createdAt: 'desc' }, take: 100 }),
    ]);

    return { issuances, transfers };
  });
}
