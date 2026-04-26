import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from '../lib/prisma.js';

type AuthRequest = FastifyRequest & { user: { sub: string; roles?: string[] } };

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

  app.get('/admin/users/brokers', { preHandler: [app.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const authRequest = request as AuthRequest;
    const roles = authRequest.user.roles ?? [];
    const isAdmin = roles.includes('ADMIN') || roles.includes('SUPER_ADMIN') || roles.includes('COIN_CHIEF_ADMIN');

    if (!isAdmin) {
      return reply.code(403).send({ message: 'Sem permissão para listar corretores virtuais.' });
    }

    const users = await prisma.user.findMany({
      where: { roles: { some: { role: { key: 'VIRTUAL_BROKER' } } } },
      select: { id: true, name: true, email: true },
      orderBy: { name: 'asc' },
    });

    return { users };
  });

}
