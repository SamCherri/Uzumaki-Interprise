import fp from 'fastify-plugin';
import jwt from '@fastify/jwt';
import { FastifyReply, FastifyRequest } from 'fastify';

export default fp(async (app) => {
  const isProduction = process.env.NODE_ENV === 'production';
  const jwtSecret = process.env.JWT_SECRET;

  if (isProduction && !jwtSecret) {
    throw new Error('JWT_SECRET é obrigatório em produção.');
  }

  app.register(jwt, {
    secret: jwtSecret ?? 'dev-secret',
  });

  app.decorate('authenticate', async function (request: FastifyRequest, reply: FastifyReply) {
    try {
      await request.jwtVerify();
    } catch {
      return reply.code(401).send({ message: 'Não autenticado.' });
    }
  });
});
