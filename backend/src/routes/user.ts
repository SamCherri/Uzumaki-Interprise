import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from '../lib/prisma.js';

type AuthRequest = FastifyRequest & { user: { sub: string; roles?: string[] } };

export async function userRoutes(app: FastifyInstance) {
  app.get('/me', { preHandler: [app.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const authRequest = request as AuthRequest;
    const userId = authRequest.user.sub;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { wallet: true, roles: { include: { role: true } } },
    });

    if (!user) {
      return reply.code(404).send({ message: 'Usuário não encontrado.' });
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      roles: user.roles.map((item) => item.role.key),
      wallet: user.wallet,
    };
  });
}
