import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';

type AuthRequest = FastifyRequest & { user: { sub: string; roles?: string[] } };

function hasAnyRole(roles: string[], allowed: string[]) {
  return allowed.some((role) => roles.includes(role));
}

export async function economyRoutes(app: FastifyInstance) {
  app.post('/economy/treasury/issue', { preHandler: [app.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const authRequest = request as AuthRequest;
    const roles = authRequest.user.roles ?? [];

    if (!roles.includes('COIN_CHIEF_ADMIN')) {
      return reply.code(403).send({ message: 'Apenas ADM Chefe da Moeda pode criar moeda virtual.' });
    }

    const schema = z.object({
      amount: z.number().positive(),
      reason: z.string().min(3),
    });

    const { amount, reason } = schema.parse(request.body);

    const treasury = (await prisma.treasuryAccount.findFirst()) ?? (await prisma.treasuryAccount.create({ data: {} }));
    const previousValue = Number(treasury.balance);
    const newValue = previousValue + amount;

    const result = await prisma.$transaction(async (tx) => {
      const updatedTreasury = await tx.treasuryAccount.update({
        where: { id: treasury.id },
        data: { balance: newValue },
      });

      await tx.coinIssuance.create({
        data: {
          createdById: authRequest.user.sub,
          amount,
          reason,
          destination: 'Tesouraria Central',
          previousValue,
          newValue,
        },
      });

      await tx.coinTransfer.create({
        data: {
          type: 'ISSUANCE_TO_TREASURY',
          senderId: authRequest.user.sub,
          amount,
          reason,
          previousValue,
          newValue,
        },
      });

      await tx.adminLog.create({
        data: {
          userId: authRequest.user.sub,
          action: 'ISSUE_VIRTUAL_COIN',
          entity: 'TreasuryAccount',
          previous: String(previousValue),
          current: String(newValue),
          reason,
        },
      });

      return updatedTreasury;
    });

    return { balance: result.balance };
  });

  app.get('/economy/treasury', { preHandler: [app.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const authRequest = request as AuthRequest;
    const roles = authRequest.user.roles ?? [];

    if (!hasAnyRole(roles, ['COIN_CHIEF_ADMIN', 'ADMIN', 'SUPER_ADMIN'])) {
      return reply.code(403).send({ message: 'Sem permissão para consultar a tesouraria central.' });
    }

    const treasury = (await prisma.treasuryAccount.findFirst()) ?? (await prisma.treasuryAccount.create({ data: {} }));

    return { balance: treasury.balance };
  });

  app.post('/economy/treasury/transfer-broker', { preHandler: [app.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const authRequest = request as AuthRequest;
    const roles = authRequest.user.roles ?? [];

    if (!hasAnyRole(roles, ['COIN_CHIEF_ADMIN', 'ADMIN', 'SUPER_ADMIN'])) {
      return reply.code(403).send({ message: 'Sem permissão para transferir moeda da tesouraria para corretor virtual.' });
    }

    const schema = z.object({
      brokerUserId: z.string().min(1),
      amount: z.number().positive(),
      reason: z.string().min(3),
    });

    const { brokerUserId, amount, reason } = schema.parse(request.body);

    const broker = await prisma.user.findUnique({
      where: { id: brokerUserId },
      include: { roles: { include: { role: true } } },
    });

    if (!broker) {
      return reply.code(404).send({ message: 'Corretor virtual não encontrado.' });
    }

    const isBroker = broker.roles.some((item) => item.role.key === 'VIRTUAL_BROKER');
    if (!isBroker) {
      return reply.code(400).send({ message: 'O usuário informado não possui cargo de corretor virtual.' });
    }

    const treasury = (await prisma.treasuryAccount.findFirst()) ?? (await prisma.treasuryAccount.create({ data: {} }));
    const previousValue = Number(treasury.balance);

    if (previousValue < amount) {
      return reply.code(400).send({ message: 'Saldo insuficiente na tesouraria central.' });
    }

    const newValue = previousValue - amount;

    await prisma.$transaction(async (tx) => {
      await tx.treasuryAccount.update({ where: { id: treasury.id }, data: { balance: newValue } });

      const brokerAccount = await tx.brokerAccount.findUnique({ where: { userId: brokerUserId } });
      if (!brokerAccount) {
        await tx.brokerAccount.create({
          data: {
            userId: brokerUserId,
            receivedTotal: amount,
            available: amount,
          },
        });
      } else {
        await tx.brokerAccount.update({
          where: { userId: brokerUserId },
          data: {
            receivedTotal: Number(brokerAccount.receivedTotal) + amount,
            available: Number(brokerAccount.available) + amount,
          },
        });
      }

      await tx.coinTransfer.create({
        data: {
          type: 'TREASURY_TO_BROKER',
          senderId: authRequest.user.sub,
          receiverId: brokerUserId,
          amount,
          reason,
          previousValue,
          newValue,
        },
      });

      await tx.adminLog.create({
        data: {
          userId: authRequest.user.sub,
          action: 'TREASURY_TO_BROKER_TRANSFER',
          entity: 'BrokerAccount',
          previous: String(previousValue),
          current: String(newValue),
          reason,
        },
      });
    });

    return { message: 'Transferência para corretor virtual concluída.' };
  });

  app.get('/economy/broker/balance', { preHandler: [app.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const authRequest = request as AuthRequest;
    const roles = authRequest.user.roles ?? [];

    if (!roles.includes('VIRTUAL_BROKER')) {
      return reply.code(403).send({ message: 'Apenas corretor virtual pode acessar este painel.' });
    }

    const brokerAccount = (await prisma.brokerAccount.findUnique({ where: { userId: authRequest.user.sub } }))
      ?? (await prisma.brokerAccount.create({ data: { userId: authRequest.user.sub } }));

    const transfers = await prisma.coinTransfer.findMany({
      where: {
        OR: [{ senderId: authRequest.user.sub }, { receiverId: authRequest.user.sub }],
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return {
      available: brokerAccount.available,
      receivedTotal: brokerAccount.receivedTotal,
      history: transfers,
    };
  });



  app.get('/economy/broker/users', { preHandler: [app.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const authRequest = request as AuthRequest;
    const roles = authRequest.user.roles ?? [];

    if (!roles.includes('VIRTUAL_BROKER')) {
      return reply.code(403).send({ message: 'Apenas corretor virtual pode listar usuários para repasse.' });
    }

    const users = await prisma.user.findMany({
      where: { id: { not: authRequest.user.sub }, isBlocked: false },
      select: { id: true, name: true, email: true },
      orderBy: { name: 'asc' },
      take: 50,
    });

    return { users };
  });

  app.post('/economy/broker/transfer-user', { preHandler: [app.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const authRequest = request as AuthRequest;
    const roles = authRequest.user.roles ?? [];

    if (!roles.includes('VIRTUAL_BROKER')) {
      return reply.code(403).send({ message: 'Apenas corretor virtual pode repassar moeda virtual.' });
    }

    const schema = z.object({
      userId: z.string().min(1),
      amount: z.number().positive(),
      reason: z.string().min(3),
    });

    const { userId, amount, reason } = schema.parse(request.body);

    const user = await prisma.user.findUnique({ where: { id: userId }, include: { wallet: true } });
    if (!user) {
      return reply.code(404).send({ message: 'Usuário destinatário não encontrado.' });
    }

    const brokerAccount = await prisma.brokerAccount.findUnique({ where: { userId: authRequest.user.sub } });
    if (!brokerAccount) {
      return reply.code(400).send({ message: 'Corretor sem conta de repasse ativa.' });
    }

    const previousBroker = Number(brokerAccount.available);
    if (previousBroker < amount) {
      return reply.code(400).send({ message: 'Saldo insuficiente do corretor virtual.' });
    }

    const nextBroker = previousBroker - amount;

    await prisma.$transaction(async (tx) => {
      await tx.brokerAccount.update({
        where: { userId: authRequest.user.sub },
        data: { available: nextBroker },
      });

      const wallet = user.wallet ?? await tx.wallet.create({ data: { userId: user.id } });
      const previousWallet = Number(wallet.availableBalance);
      const newWallet = previousWallet + amount;

      await tx.wallet.update({
        where: { userId: user.id },
        data: { availableBalance: newWallet },
      });

      await tx.coinTransfer.create({
        data: {
          type: 'BROKER_TO_USER',
          senderId: authRequest.user.sub,
          receiverId: user.id,
          amount,
          reason,
          previousValue: previousBroker,
          newValue: nextBroker,
        },
      });

      await tx.transaction.create({
        data: {
          walletId: wallet.id,
          type: 'BROKER_TRANSFER_IN',
          amount,
          description: `Repasse de corretor virtual: ${reason}`,
        },
      });

      await tx.adminLog.create({
        data: {
          userId: authRequest.user.sub,
          action: 'BROKER_TO_USER_TRANSFER',
          entity: 'Wallet',
          previous: String(previousWallet),
          current: String(newWallet),
          reason,
        },
      });
    });

    return { message: 'Repasse para usuário concluído.' };
  });
}
