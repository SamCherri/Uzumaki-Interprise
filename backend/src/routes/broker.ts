import { Prisma } from '@prisma/client';
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';

type AuthRequest = FastifyRequest & { user: { sub: string; roles?: string[] } };

const transferSchema = z.object({
  userId: z.string().min(1),
  amount: z.coerce.number().positive(),
  reason: z.string().min(3),
});

function requireBroker(reply: FastifyReply, roles: string[]) {
  const isBroker = roles.includes('VIRTUAL_BROKER') || roles.includes('SUPER_ADMIN');
  if (!isBroker) {
    reply.code(403).send({ message: 'Somente corretor virtual pode acessar esta rota.' });
    return false;
  }
  return true;
}

export async function brokerRoutes(app: FastifyInstance) {
  app.get('/broker/balance', { preHandler: [app.authenticate] }, async (request, reply) => {
    const authRequest = request as AuthRequest;
    const roles = authRequest.user.roles ?? [];

    if (!requireBroker(reply, roles)) return;

    const broker = await prisma.brokerAccount.upsert({
      where: { userId: authRequest.user.sub },
      update: {},
      create: { userId: authRequest.user.sub },
    });

    return {
      available: broker.available,
      receivedTotal: broker.receivedTotal,
    };
  });

  app.get('/broker/history', { preHandler: [app.authenticate] }, async (request, reply) => {
    const authRequest = request as AuthRequest;
    const roles = authRequest.user.roles ?? [];

    if (!requireBroker(reply, roles)) return;

    const transfers = await prisma.coinTransfer.findMany({
      where: {
        OR: [{ senderId: authRequest.user.sub }, { receiverId: authRequest.user.sub }],
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return { transfers };
  });

  app.post('/broker/transfer-to-user', { preHandler: [app.authenticate] }, async (request, reply) => {
    const authRequest = request as AuthRequest;
    const roles = authRequest.user.roles ?? [];

    if (!requireBroker(reply, roles)) return;

    try {
      const body = transferSchema.parse(request.body);

      const result = await prisma.$transaction(async (tx) => {
      const broker = await tx.brokerAccount.upsert({
        where: { userId: authRequest.user.sub },
        update: {},
        create: { userId: authRequest.user.sub },
      });

      const amount = new Prisma.Decimal(body.amount);

      if (broker.available.lessThan(amount)) {
        throw new Error('Saldo insuficiente no corretor.');
      }

      const targetUser = await tx.user.findUnique({ where: { id: body.userId }, include: { wallet: true } });
      if (!targetUser) {
        throw new Error('Usuário de destino não encontrado.');
      }

      const wallet = targetUser.wallet ?? await tx.wallet.create({ data: { userId: targetUser.id } });

      const brokerPrevious = broker.available;
      const brokerNext = broker.available.sub(amount);
      const userPrevious = wallet.availableBalance;
      const userNext = wallet.availableBalance.add(amount);

      const transfer = await tx.coinTransfer.create({
        data: {
          type: 'BROKER_TO_USER',
          senderId: authRequest.user.sub,
          receiverId: targetUser.id,
          amount,
          reason: body.reason,
          previousValue: brokerPrevious,
          newValue: brokerNext,
        },
      });

      await tx.brokerAccount.update({ where: { id: broker.id }, data: { available: brokerNext } });
      await tx.wallet.update({ where: { id: wallet.id }, data: { availableBalance: userNext } });

      await tx.transaction.create({
        data: {
          walletId: wallet.id,
          type: 'BROKER_TRANSFER_IN',
          amount,
          description: `Recebido do corretor virtual (${authRequest.user.sub}) - ${body.reason}`,
        },
      });

      await tx.adminLog.create({
        data: {
          userId: authRequest.user.sub,
          action: 'BROKER_TRANSFER_TO_USER',
          entity: 'Wallet',
          reason: body.reason,
          previous: JSON.stringify({ brokerBalance: brokerPrevious.toString(), userBalance: userPrevious.toString() }),
          current: JSON.stringify({ brokerBalance: brokerNext.toString(), userBalance: userNext.toString(), amount: amount.toString(), targetUserId: targetUser.id }),
          ip: request.ip,
          userAgent: request.headers['user-agent'] ?? null,
        },
      });

      return {
        transfer,
        brokerBalance: brokerNext,
        userBalance: userNext,
      };
    });

      return reply.code(201).send(result);
    } catch (error) {
      return reply.code(400).send({ message: (error as Error).message });
    }
  });
}
