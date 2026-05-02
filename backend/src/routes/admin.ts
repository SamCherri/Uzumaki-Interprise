import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { assertAdminPassword } from '../services/admin-security-service.js';

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

async function resolveUniqueUserByRef(
  tx: Prisma.TransactionClient,
  ref: string,
  roleKey?: string,
) {
  const trimmedRef = ref.trim();
  const candidates = await tx.user.findMany({
    where: {
      ...(roleKey ? { roles: { some: { role: { key: roleKey } } } } : {}),
      OR: [
        { bankAccountNumber: { equals: trimmedRef } },
        { characterName: { equals: trimmedRef, mode: 'insensitive' } },
        { name: { equals: trimmedRef, mode: 'insensitive' } },
        { email: { equals: trimmedRef.toLowerCase(), mode: 'insensitive' } },
      ],
    },
    include: { roles: { select: { role: { select: { key: true } } } } },
    take: 2,
  });

  if (candidates.length === 0) throw new Error('Usuário não encontrado.');
  if (candidates.length > 1) throw new Error('Referência ambígua. Use a Conta RP exata ou o email técnico.');
  return candidates[0];
}

export async function adminRoutes(app: FastifyInstance) {
  app.get('/admin/overview', { preHandler: [app.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const authRequest = request as AuthRequest;
    const roles = authRequest.user.roles ?? [];
    const isAdmin = roles.includes('ADMIN') || roles.includes('SUPER_ADMIN') || roles.includes('COIN_CHIEF_ADMIN');

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

  app.post('/admin/treasury/issuance', { preHandler: [app.authenticate], config: { rateLimit: process.env.NODE_ENV === 'test' ? false : { max: 20, timeWindow: '1 minute' } } }, async (request, reply) => {
    const authRequest = request as AuthRequest;
    const roles = authRequest.user.roles ?? [];

    if (!requireRole(reply, roles, ['COIN_CHIEF_ADMIN', 'SUPER_ADMIN'], 'Somente ADM Chefe da Moeda pode emitir RPC.')) {
      return;
    }

    try {
      const schema = z.object({
        amount: amountSchema,
        reason: z.string().min(3),
        adminPassword: z.string().min(1),
      });
      const body = schema.parse(request.body);
      await assertAdminPassword(authRequest.user.sub, body.adminPassword);

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

  app.post('/admin/treasury/transfer-to-broker', { preHandler: [app.authenticate], config: { rateLimit: process.env.NODE_ENV === 'test' ? false : { max: 20, timeWindow: '1 minute' } } }, async (request, reply) => {
    const authRequest = request as AuthRequest;
    const roles = authRequest.user.roles ?? [];

    if (!requireRole(reply, roles, ['ADMIN', 'SUPER_ADMIN', 'COIN_CHIEF_ADMIN'], 'Sem permissão para enviar R$ a corretor.')) {
      return;
    }

    try {
      const schema = z.object({
        brokerUserId: z.string().min(1).optional(),
        brokerEmail: z.string().email().optional(),
        brokerRef: z.string().min(1).optional(),
        amount: amountSchema,
        reason: z.string().min(3),
        adminPassword: z.string().min(1),
      }).superRefine((value, ctx) => {
        if (!value.brokerEmail && !value.brokerUserId && !value.brokerRef) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Informe o e-mail do corretor.',
            path: ['brokerEmail'],
          });
        }
      });
      const body = schema.parse(request.body);
      await assertAdminPassword(authRequest.user.sub, body.adminPassword);
      const brokerRef = body.brokerRef?.trim();

      const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const treasury = await tx.treasuryAccount.findFirstOrThrow();
      const amount = new Decimal(body.amount);

      if (treasury.balance.lessThan(amount)) {
        throw new Error('Saldo em R$ insuficiente na tesouraria.');
      }

      const brokerUser = body.brokerUserId
        ? await tx.user.findFirst({ where: { id: body.brokerUserId, roles: { some: { role: { key: 'VIRTUAL_BROKER' } } } } })
        : body.brokerEmail
          ? await tx.user.findFirst({ where: { email: body.brokerEmail, roles: { some: { role: { key: 'VIRTUAL_BROKER' } } } } })
          : await resolveUniqueUserByRef(tx, brokerRef ?? '', 'VIRTUAL_BROKER');

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


  app.post('/admin/treasury/transfer-to-user', { preHandler: [app.authenticate], config: { rateLimit: process.env.NODE_ENV === 'test' ? false : { max: 20, timeWindow: '1 minute' } } }, async (request, reply) => {
    const authRequest = request as AuthRequest;
    const roles = authRequest.user.roles ?? [];

    if (!requireRole(reply, roles, ['ADMIN', 'SUPER_ADMIN', 'COIN_CHIEF_ADMIN'], 'Sem permissão para enviar R$ a usuário.')) {
      return;
    }

    try {
      const schema = z.object({
        userId: z.string().min(1).optional(),
        userEmail: z.string().email().optional(),
        userRef: z.string().min(1).optional(),
        amount: amountSchema,
        reason: z.string().trim().min(3),
        adminPassword: z.string().min(1),
      }).superRefine((value, ctx) => {
        if (!value.userId && !value.userEmail && !value.userRef) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Informe o e-mail ou id do usuário de destino.',
            path: ['userEmail'],
          });
        }
      });

      const parsed = schema.parse(request.body);
      const userEmail = parsed.userEmail?.trim().toLowerCase();
      const userRef = parsed.userRef?.trim();

      const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const treasury = await tx.treasuryAccount.findFirstOrThrow();
        const amount = new Decimal(parsed.amount);

        const targetUser = parsed.userId
          ? await tx.user.findUnique({ where: { id: parsed.userId } })
          : userEmail
            ? await tx.user.findUnique({ where: { email: userEmail } })
            : await resolveUniqueUserByRef(tx, userRef ?? '');

        if (!targetUser) {
          throw new Error('Usuário de destino não encontrado.');
        }

        const userWallet = await tx.wallet.upsert({
          where: { userId: targetUser.id },
          update: {},
          create: {
            userId: targetUser.id,
            availableBalance: new Decimal(0),
            lockedBalance: new Decimal(0),
            pendingWithdrawalBalance: new Decimal(0),
            fiatAvailableBalance: new Decimal(0),
            fiatLockedBalance: new Decimal(0),
            fiatPendingWithdrawalBalance: new Decimal(0),
            rpcAvailableBalance: new Decimal(0),
            rpcLockedBalance: new Decimal(0),
          },
        });

        const treasuryPrevious = treasury.balance;
        const userPrevious = userWallet.fiatAvailableBalance;

        const treasuryMutation = await tx.treasuryAccount.updateMany({
          where: {
            id: treasury.id,
            balance: { gte: amount },
          },
          data: {
            balance: { decrement: amount },
          },
        });

        if (treasuryMutation.count !== 1) {
          throw new Error('Saldo em R$ insuficiente na tesouraria.');
        }

        const updatedTreasury = await tx.treasuryAccount.findUniqueOrThrow({
          where: { id: treasury.id },
        });

        const updatedWallet = await tx.wallet.update({
          where: { id: userWallet.id },
          data: {
            fiatAvailableBalance: { increment: amount },
          },
        });


        const transfer = await tx.coinTransfer.create({
          data: {
            type: 'ADJUSTMENT',
            senderId: null,
            receiverId: targetUser.id,
            amount,
            reason: parsed.reason,
            previousValue: treasuryPrevious,
            newValue: updatedTreasury.balance,
          },
        });

        await tx.transaction.create({
          data: {
            walletId: userWallet.id,
            type: 'ADMIN_TREASURY_FIAT_TRANSFER_IN',
            amount,
            description: `R$ recebido da tesouraria administrativa - ${parsed.reason}`,
          },
        });

        await tx.adminLog.create({
          data: {
            userId: authRequest.user.sub,
            action: 'TREASURY_TRANSFER_TO_USER',
            entity: 'Wallet',
            reason: parsed.reason,
            previous: JSON.stringify({
              targetUserId: targetUser.id,
              targetUserEmail: targetUser.email,
              treasuryBalance: treasuryPrevious.toString(),
              userFiatAvailableBalance: userPrevious.toString(),
            }),
            current: JSON.stringify({
              targetUserId: targetUser.id,
              targetUserEmail: targetUser.email,
              treasuryBalance: updatedTreasury.balance.toString(),
              userFiatAvailableBalance: updatedWallet.fiatAvailableBalance.toString(),
              amount: amount.toString(),
            }),
            ip: request.ip,
            userAgent: request.headers['user-agent'] ?? null,
          },
        });

        return {
          message: 'R$ depositado na carteira do jogador com sucesso.',
          transfer,
          treasuryBalance: updatedTreasury.balance,
          userBalance: updatedWallet.fiatAvailableBalance,
        };
      });

      return reply.code(201).send(result);
    } catch (error) {
      return reply.code(400).send({ message: (error as Error).message });
    }
  });


  app.post('/admin/platform-account/withdraw-to-admin', { preHandler: [app.authenticate], config: { rateLimit: process.env.NODE_ENV === 'test' ? false : { max: 12, timeWindow: '1 minute' } } }, async (request, reply) => {
    const authRequest = request as AuthRequest;
    const roles = authRequest.user.roles ?? [];

    if (!requireRole(reply, roles, ['SUPER_ADMIN', 'COIN_CHIEF_ADMIN'], 'Sem permissão para retirar lucro da Exchange.')) {
      return;
    }

    try {
      const schema = z.object({
        adminEmail: z.string().email().optional(),
        adminRef: z.string().min(1).optional(),
        adminId: z.string().min(1).optional(),
        amount: amountSchema,
        reason: z.string().trim().min(3),
        adminPassword: z.string().min(1),
      }).superRefine((value, ctx) => {
        if (!value.adminEmail && !value.adminId && !value.adminRef) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Informe o e-mail ou id do administrador de destino.',
            path: ['adminEmail'],
          });
        }
      });

      const parsed = schema.parse(request.body);
      await assertAdminPassword(authRequest.user.sub, parsed.adminPassword);
      const targetEmail = parsed.adminEmail?.trim().toLowerCase();
      const adminRef = parsed.adminRef?.trim();

      const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const amount = new Decimal(parsed.amount);
        const targetAdmin = parsed.adminId
          ? await tx.user.findFirst({ where: { id: parsed.adminId }, include: { roles: { select: { role: { select: { key: true } } } } } })
          : targetEmail
            ? await tx.user.findFirst({ where: { email: targetEmail }, include: { roles: { select: { role: { select: { key: true } } } } } })
            : await resolveUniqueUserByRef(tx, adminRef ?? '');

        if (!targetAdmin) {
          throw new Error('Administrador de destino não encontrado.');
        }

        const hasAdminRole = targetAdmin.roles.some(({ role }: { role: { key: string } }) => ['SUPER_ADMIN', 'ADMIN', 'COIN_CHIEF_ADMIN'].includes(role.key));

        if (!hasAdminRole) {
          throw new Error('Usuário de destino não possui permissão administrativa.');
        }

        const platformAccount = await tx.platformAccount.findFirstOrThrow();
        const previousPlatformBalance = platformAccount.balance;
        const previousPlatformWithdrawn = new Decimal((platformAccount as { totalWithdrawn?: Decimal }).totalWithdrawn ?? 0);

        if (previousPlatformBalance.lessThan(amount)) {
          throw new Error('Saldo insuficiente na conta da Exchange.');
        }

        const debitCount = await tx.$executeRaw`
          UPDATE "PlatformAccount"
          SET "balance" = "balance" - ${amount},
              "totalWithdrawn" = COALESCE("totalWithdrawn", 0) + ${amount}
          WHERE "id" = ${platformAccount.id}
            AND "balance" >= ${amount}
        `;

        if (Number(debitCount) !== 1) {
          throw new Error('Saldo insuficiente na conta da Exchange.');
        }

        const wallet = await tx.wallet.upsert({
          where: { userId: targetAdmin.id },
          update: {},
          create: {
            userId: targetAdmin.id,
            availableBalance: 0,
            lockedBalance: 0,
            pendingWithdrawalBalance: 0,
          },
        });

        const previousAdminWalletBalance = wallet.fiatAvailableBalance;
        const updatedWallet = await tx.wallet.update({
          where: { id: wallet.id },
          data: { fiatAvailableBalance: { increment: amount } },
        });

        await tx.transaction.create({
          data: {
            walletId: updatedWallet.id,
            type: 'PLATFORM_PROFIT_WITHDRAWAL_IN',
            amount,
            description: `R$ recebido da tesouraria administrativa - ${parsed.reason}`,
          },
        });

        const platformBalanceAfter = previousPlatformBalance.sub(amount);
        const platformWithdrawnAfter = previousPlatformWithdrawn.add(amount);

        await tx.adminLog.create({
          data: {
            userId: authRequest.user.sub,
            action: 'PLATFORM_PROFIT_WITHDRAWAL',
            entity: 'PlatformAccount',
            reason: parsed.reason,
            previous: JSON.stringify({
              platformBalance: previousPlatformBalance.toString(),
              platformTotalWithdrawn: previousPlatformWithdrawn.toString(),
              adminFiatAvailableBalance: previousAdminWalletBalance.toString(),
              adminId: targetAdmin.id,
              adminEmail: targetAdmin.email,
            }),
            current: JSON.stringify({
              platformBalance: platformBalanceAfter.toString(),
              platformTotalWithdrawn: platformWithdrawnAfter.toString(),
              adminFiatAvailableBalance: updatedWallet.fiatAvailableBalance.toString(),
              adminId: targetAdmin.id,
              adminEmail: targetAdmin.email,
              amount: amount.toString(),
              reason: parsed.reason,
            }),
            ip: request.ip,
            userAgent: request.headers['user-agent'] ?? null,
          },
        });

        return {
          message: 'Lucro da Exchange transferido para o administrador com sucesso.',
          platformBalance: platformBalanceAfter,
          adminBalance: updatedWallet.fiatAvailableBalance,
        };
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
      totalWithdrawn: (platform as { totalWithdrawn?: Decimal } | null)?.totalWithdrawn ?? new Decimal(0),
      updatedAt: platform?.updatedAt ?? null,
    };
  });

  app.get('/admin/company-revenue-accounts', { preHandler: [app.authenticate] }, async (request, reply) => {
    const authRequest = request as AuthRequest;
    const roles = authRequest.user.roles ?? [];

    if (!requireRole(reply, roles, ['ADMIN', 'SUPER_ADMIN', 'COIN_CHIEF_ADMIN', 'AUDITOR'], 'Sem permissão para consultar receitas dos projetos/tokens.')) {
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
      accounts: accounts.map((account: { companyId: string; company: { ticker: string; name: string }; balance: unknown; totalReceivedFees: unknown; totalWithdrawn: unknown }) => ({
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

    if (!requireRole(reply, roles, ['ADMIN', 'SUPER_ADMIN', 'COIN_CHIEF_ADMIN', 'AUDITOR'], 'Sem permissão para histórico de RPC.')) {
      return;
    }

    const [issuances, transfers] = await Promise.all([
      prisma.coinIssuance.findMany({ orderBy: { createdAt: 'desc' }, take: 50 }),
      prisma.coinTransfer.findMany({ orderBy: { createdAt: 'desc' }, take: 100 }),
    ]);

    return { issuances, transfers };
  });
}
