import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';

type AuthRequest = FastifyRequest & { user: { sub: string; roles?: string[] } };

const adminRoles = ['ADMIN', 'SUPER_ADMIN', 'COIN_CHIEF_ADMIN'];

const requestWithdrawalSchema = z.object({
  amount: z.coerce.number().positive('Quantidade deve ser maior que zero.'),
  userNote: z.string().max(400).optional(),
});

const adminNoteSchema = z.object({
  adminNote: z.string().max(400).optional(),
});

function hasAdminRole(roles: string[]) {
  return adminRoles.some((role) => roles.includes(role));
}

async function generateWithdrawalCode(tx: Prisma.TransactionClient) {
  const latest = await tx.withdrawalRequest.findFirst({
    where: { code: { startsWith: 'WD-' } },
    orderBy: { createdAt: 'desc' },
    select: { code: true },
  });

  const lastNumeric = latest?.code.match(/^WD-(\d+)$/)?.[1];
  if (lastNumeric) {
    const next = Number(lastNumeric) + 1;
    return `WD-${String(next).padStart(6, '0')}`;
  }

  const random = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `SAQ-${random}`;
}

async function createWalletTransaction(tx: Prisma.TransactionClient, walletId: string, type: string, amount: Decimal, description: string) {
  await tx.transaction.create({
    data: {
      walletId,
      type,
      amount,
      description,
    },
  });
}

export async function withdrawalsRoutes(app: FastifyInstance) {
  app.get('/withdrawals/me', { preHandler: [app.authenticate] }, async (request) => {
    const authRequest = request as AuthRequest;

    const withdrawals = await prisma.withdrawalRequest.findMany({
      where: { userId: authRequest.user.sub },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return { withdrawals };
  });

  app.post('/withdrawals', { preHandler: [app.authenticate] }, async (request, reply) => {
    const authRequest = request as AuthRequest;

    try {
      const body = requestWithdrawalSchema.parse(request.body);

      const created = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const wallet = await tx.wallet.findUnique({ where: { userId: authRequest.user.sub } });
        if (!wallet) {
          throw new Error('Carteira não encontrada.');
        }

        const amount = new Decimal(body.amount);

        if (wallet.availableBalance.lessThan(amount)) {
          throw new Error('Saldo disponível insuficiente para saque.');
        }

        const walletMutation = await tx.wallet.updateMany({
          where: {
            id: wallet.id,
            availableBalance: { gte: amount },
          },
          data: {
            availableBalance: { decrement: amount },
            pendingWithdrawalBalance: { increment: amount },
          },
        });

        if (walletMutation.count !== 1) {
          throw new Error('Saldo disponível insuficiente para saque.');
        }

        const code = await generateWithdrawalCode(tx);

        const withdrawal = await tx.withdrawalRequest.create({
          data: {
            code,
            userId: authRequest.user.sub,
            amount,
            status: 'PENDING',
            userNote: body.userNote?.trim() || null,
          },
        });

        const updatedWallet = await tx.wallet.findUniqueOrThrow({ where: { id: wallet.id } });

        await createWalletTransaction(tx, wallet.id, 'WITHDRAWAL_LOCK', amount, 'RPC bloqueado para saque');

        await tx.adminLog.create({
          data: {
            userId: authRequest.user.sub,
            action: 'WITHDRAWAL_REQUEST_CREATED',
            entity: 'WithdrawalRequest',
            reason: body.userNote ?? 'Solicitação de saque criada pelo usuário.',
            previous: JSON.stringify({
              availableBalance: wallet.availableBalance.toString(),
              pendingWithdrawalBalance: wallet.pendingWithdrawalBalance.toString(),
            }),
            current: JSON.stringify({
              code,
              availableBalance: updatedWallet.availableBalance.toString(),
              pendingWithdrawalBalance: updatedWallet.pendingWithdrawalBalance.toString(),
              amount: amount.toString(),
            }),
            ip: request.ip,
            userAgent: request.headers['user-agent'] ?? null,
          },
        });

        return withdrawal;
      });

      return reply.code(201).send(created);
    } catch (error) {
      return reply.code(400).send({ message: (error as Error).message });
    }
  });

  app.post('/withdrawals/:id/cancel', { preHandler: [app.authenticate] }, async (request, reply) => {
    const authRequest = request as AuthRequest;
    const params = z.object({ id: z.string().min(1) }).parse(request.params);

    try {
      const canceled = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const withdrawal = await tx.withdrawalRequest.findUnique({ where: { id: params.id } });

        if (!withdrawal || withdrawal.userId !== authRequest.user.sub) {
          throw new Error('Solicitação de saque não encontrada para este usuário.');
        }

        if (withdrawal.status !== 'PENDING') {
          throw new Error('Somente solicitações pendentes podem ser canceladas.');
        }

        const wallet = await tx.wallet.findUniqueOrThrow({ where: { userId: authRequest.user.sub } });

        const nextPending = wallet.pendingWithdrawalBalance.sub(withdrawal.amount);
        const nextAvailable = wallet.availableBalance.add(withdrawal.amount);

        if (nextPending.lessThan(0) || nextAvailable.lessThan(0)) {
          throw new Error('Operação inválida de saldo ao cancelar saque.');
        }

        await tx.wallet.update({
          where: { id: wallet.id },
          data: {
            pendingWithdrawalBalance: nextPending,
            availableBalance: nextAvailable,
          },
        });

        const updated = await tx.withdrawalRequest.update({
          where: { id: withdrawal.id },
          data: {
            status: 'CANCELED',
            canceledAt: new Date(),
          },
        });

        await createWalletTransaction(tx, wallet.id, 'WITHDRAWAL_CANCELED', withdrawal.amount, 'Saque cancelado');

        await tx.adminLog.create({
          data: {
            userId: authRequest.user.sub,
            action: 'WITHDRAWAL_REQUEST_CANCELED_BY_USER',
            entity: 'WithdrawalRequest',
            reason: 'Solicitação cancelada pelo usuário.',
            previous: JSON.stringify({
              status: withdrawal.status,
              availableBalance: wallet.availableBalance.toString(),
              pendingWithdrawalBalance: wallet.pendingWithdrawalBalance.toString(),
            }),
            current: JSON.stringify({
              status: 'CANCELED',
              availableBalance: nextAvailable.toString(),
              pendingWithdrawalBalance: nextPending.toString(),
            }),
            ip: request.ip,
            userAgent: request.headers['user-agent'] ?? null,
          },
        });

        return updated;
      });

      return canceled;
    } catch (error) {
      return reply.code(400).send({ message: (error as Error).message });
    }
  });

  app.get('/admin/withdrawals', { preHandler: [app.authenticate] }, async (request, reply) => {
    const authRequest = request as AuthRequest;
    const roles = authRequest.user.roles ?? [];

    if (!hasAdminRole(roles)) {
      return reply.code(403).send({ message: 'Sem permissão para visualizar saques.' });
    }

    const query = z.object({
      status: z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'REJECTED', 'CANCELED']).optional(),
      userEmail: z.string().email().optional(),
      code: z.string().min(2).optional(),
    }).parse(request.query);

    const withdrawals = await prisma.withdrawalRequest.findMany({
      where: {
        ...(query.status ? { status: query.status } : {}),
        ...(query.code ? { code: { contains: query.code, mode: 'insensitive' } } : {}),
        ...(query.userEmail ? { user: { email: query.userEmail.toLowerCase() } } : {}),
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    return { withdrawals };
  });

  app.post('/admin/withdrawals/:id/mark-processing', { preHandler: [app.authenticate] }, async (request, reply) => {
    const authRequest = request as AuthRequest;
    const roles = authRequest.user.roles ?? [];

    if (!hasAdminRole(roles)) {
      return reply.code(403).send({ message: 'Sem permissão para processar saques.' });
    }

    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const body = adminNoteSchema.parse(request.body);

    try {
      const updated = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const withdrawal = await tx.withdrawalRequest.findUnique({ where: { id: params.id } });
        if (!withdrawal) throw new Error('Saque não encontrado.');
        if (withdrawal.status !== 'PENDING') throw new Error('Somente saque pendente pode ser marcado em processamento.');

        const wallet = await tx.wallet.findUniqueOrThrow({ where: { userId: withdrawal.userId } });

        const next = await tx.withdrawalRequest.update({
          where: { id: withdrawal.id },
          data: {
            status: 'PROCESSING',
            processingAt: new Date(),
            reviewedById: authRequest.user.sub,
            adminNote: body.adminNote?.trim() || null,
          },
        });

        await createWalletTransaction(tx, wallet.id, 'WITHDRAWAL_PROCESSING', withdrawal.amount, 'Saque em processamento');

        await tx.adminLog.create({
          data: {
            userId: authRequest.user.sub,
            action: 'WITHDRAWAL_MARKED_PROCESSING',
            entity: 'WithdrawalRequest',
            reason: body.adminNote ?? 'Saque marcado em processamento.',
            previous: JSON.stringify({ status: withdrawal.status }),
            current: JSON.stringify({ status: next.status, reviewedById: authRequest.user.sub }),
            ip: request.ip,
            userAgent: request.headers['user-agent'] ?? null,
          },
        });

        return next;
      });

      return updated;
    } catch (error) {
      return reply.code(400).send({ message: (error as Error).message });
    }
  });

  app.post('/admin/withdrawals/:id/complete', { preHandler: [app.authenticate] }, async (request, reply) => {
    const authRequest = request as AuthRequest;
    const roles = authRequest.user.roles ?? [];

    if (!hasAdminRole(roles)) {
      return reply.code(403).send({ message: 'Sem permissão para concluir saques.' });
    }

    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const body = adminNoteSchema.parse(request.body);

    try {
      const updated = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const withdrawal = await tx.withdrawalRequest.findUnique({ where: { id: params.id } });
        if (!withdrawal) throw new Error('Saque não encontrado.');

        const wallet = await tx.wallet.findUniqueOrThrow({ where: { userId: withdrawal.userId } });
        const transition = await tx.withdrawalRequest.updateMany({
          where: {
            id: withdrawal.id,
            status: { in: ['PENDING', 'PROCESSING'] },
          },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
            reviewedById: authRequest.user.sub,
            adminNote: body.adminNote?.trim() || null,
          },
        });

        if (transition.count !== 1) {
          throw new Error('Somente saque pendente ou em processamento pode ser concluído.');
        }

        const walletMutation = await tx.wallet.updateMany({
          where: {
            id: wallet.id,
            pendingWithdrawalBalance: { gte: withdrawal.amount },
          },
          data: { pendingWithdrawalBalance: { decrement: withdrawal.amount } },
        });

        if (walletMutation.count !== 1) {
          throw new Error('Saldo pendente insuficiente para concluir saque.');
        }

        const updatedWallet = await tx.wallet.findUniqueOrThrow({ where: { id: wallet.id } });
        const next = await tx.withdrawalRequest.findUniqueOrThrow({ where: { id: withdrawal.id } });

        await createWalletTransaction(tx, wallet.id, 'WITHDRAWAL_COMPLETED', withdrawal.amount, 'Saque concluído');

        await tx.adminLog.create({
          data: {
            userId: authRequest.user.sub,
            action: 'WITHDRAWAL_COMPLETED',
            entity: 'WithdrawalRequest',
            reason: body.adminNote ?? 'Saque concluído no painel administrativo.',
            previous: JSON.stringify({ status: withdrawal.status, pendingWithdrawalBalance: wallet.pendingWithdrawalBalance.toString() }),
            current: JSON.stringify({ status: next.status, pendingWithdrawalBalance: updatedWallet.pendingWithdrawalBalance.toString() }),
            ip: request.ip,
            userAgent: request.headers['user-agent'] ?? null,
          },
        });

        return next;
      });

      return updated;
    } catch (error) {
      return reply.code(400).send({ message: (error as Error).message });
    }
  });

  app.post('/admin/withdrawals/:id/reject', { preHandler: [app.authenticate] }, async (request, reply) => {
    const authRequest = request as AuthRequest;
    const roles = authRequest.user.roles ?? [];

    if (!hasAdminRole(roles)) {
      return reply.code(403).send({ message: 'Sem permissão para rejeitar saques.' });
    }

    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const body = adminNoteSchema.parse(request.body);

    try {
      const updated = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const withdrawal = await tx.withdrawalRequest.findUnique({ where: { id: params.id } });
        if (!withdrawal) throw new Error('Saque não encontrado.');

        const wallet = await tx.wallet.findUniqueOrThrow({ where: { userId: withdrawal.userId } });
        const transition = await tx.withdrawalRequest.updateMany({
          where: {
            id: withdrawal.id,
            status: { in: ['PENDING', 'PROCESSING'] },
          },
          data: {
            status: 'REJECTED',
            rejectedAt: new Date(),
            reviewedById: authRequest.user.sub,
            adminNote: body.adminNote?.trim() || null,
          },
        });

        if (transition.count !== 1) {
          throw new Error('Somente saque pendente ou em processamento pode ser rejeitado.');
        }

        const walletMutation = await tx.wallet.updateMany({
          where: {
            id: wallet.id,
            pendingWithdrawalBalance: { gte: withdrawal.amount },
          },
          data: {
            pendingWithdrawalBalance: { decrement: withdrawal.amount },
            availableBalance: { increment: withdrawal.amount },
          },
        });

        if (walletMutation.count !== 1) {
          throw new Error('Operação inválida de saldo ao rejeitar saque.');
        }

        const updatedWallet = await tx.wallet.findUniqueOrThrow({ where: { id: wallet.id } });
        const next = await tx.withdrawalRequest.findUniqueOrThrow({ where: { id: withdrawal.id } });

        await createWalletTransaction(tx, wallet.id, 'WITHDRAWAL_REJECTED', withdrawal.amount, 'Saque rejeitado');

        await tx.adminLog.create({
          data: {
            userId: authRequest.user.sub,
            action: 'WITHDRAWAL_REJECTED',
            entity: 'WithdrawalRequest',
            reason: body.adminNote ?? 'Saque rejeitado no painel administrativo.',
            previous: JSON.stringify({
              status: withdrawal.status,
              availableBalance: wallet.availableBalance.toString(),
              pendingWithdrawalBalance: wallet.pendingWithdrawalBalance.toString(),
            }),
            current: JSON.stringify({
              status: next.status,
              availableBalance: updatedWallet.availableBalance.toString(),
              pendingWithdrawalBalance: updatedWallet.pendingWithdrawalBalance.toString(),
            }),
            ip: request.ip,
            userAgent: request.headers['user-agent'] ?? null,
          },
        });

        return next;
      });

      return updated;
    } catch (error) {
      return reply.code(400).send({ message: (error as Error).message });
    }
  });
}
