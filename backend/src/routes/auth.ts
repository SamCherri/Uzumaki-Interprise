import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z, ZodError } from 'zod';
import { loginUser, registerUser } from '../services/auth-service.js';
import { prisma } from '../lib/prisma.js';

export async function authRoutes(app: FastifyInstance) {
  app.post('/auth/register', async (request: FastifyRequest, reply: FastifyReply) => {
    const schema = z.object({
      name: z.string().min(3),
      characterName: z.string().min(3),
      bankAccountNumber: z.string().min(3),
      email: z.string().email(),
      password: z.string().min(8),
    });

    try {
      const body = schema.parse(request.body);
      const user = await registerUser(body.name, body.characterName, body.bankAccountNumber, body.email, body.password);
      await app.logAdmin({ action: 'CREATE_ACCOUNT', entity: 'User', userId: user.id, reason: 'Cadastro inicial' });

      return reply.code(201).send({
        id: user.id,
        name: user.name,
        characterName: user.characterName,
        bankAccountNumber: user.bankAccountNumber,
        email: user.email,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        const firstIssue = error.issues[0];
        return reply.code(400).send({ message: firstIssue?.message ?? 'Dados de cadastro inválidos.' });
      }
      return reply.code(400).send({ message: (error as Error).message });
    }
  });



  app.get('/auth/me', { preHandler: [app.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const schema = z.object({ sub: z.string() });
    const payload = schema.parse(request.user);

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        wallet: true,
        roles: { include: { role: true } },
      },
    });

    if (!user) {
      return reply.code(401).send({ message: 'Não autenticado.' });
    }

    const roles = user.roles.map((item: { role: { key: string } }) => item.role.key);

    return {
      user: {
        id: user.id,
        name: user.name,
        characterName: user.characterName,
        bankAccountNumber: user.bankAccountNumber,
        email: user.email,
        roles,
        isBlocked: user.isBlocked,
        createdAt: user.createdAt,
      },
      wallet: user.wallet
        ? {
            fiatAvailableBalance: user.wallet.fiatAvailableBalance,
            fiatLockedBalance: user.wallet.fiatLockedBalance,
            fiatPendingWithdrawalBalance: user.wallet.fiatPendingWithdrawalBalance,
            rpcAvailableBalance: user.wallet.rpcAvailableBalance,
            rpcLockedBalance: user.wallet.rpcLockedBalance,
            availableBalance: user.wallet.availableBalance,
            lockedBalance: user.wallet.lockedBalance,
            pendingWithdrawalBalance: user.wallet.pendingWithdrawalBalance,
          }
        : {
            fiatAvailableBalance: '0',
            fiatLockedBalance: '0',
            fiatPendingWithdrawalBalance: '0',
            rpcAvailableBalance: '0',
            rpcLockedBalance: '0',
            availableBalance: '0',
            lockedBalance: '0',
            pendingWithdrawalBalance: '0',
          },
    };
  });

  app.post('/auth/login', async (request: FastifyRequest, reply: FastifyReply) => {
    const schema = z.object({ email: z.string().email(), password: z.string().min(8) });
    const body = schema.parse(request.body);

    try {
      const user = await loginUser(body.email, body.password);
      const roles = user.roles.map((item: { role: { key: string } }) => item.role.key);

      const token = await reply.jwtSign({ sub: user.id, roles });
      await app.logAdmin({ action: 'LOGIN', entity: 'User', userId: user.id, reason: 'Login bem-sucedido' });

      return { token, user: { id: user.id, name: user.name, email: user.email, roles } };
    } catch (error) {
      return reply.code(400).send({ message: (error as Error).message });
    }
  });
}
