import fp from 'fastify-plugin';
import jwt from '@fastify/jwt';
import { FastifyReply, FastifyRequest } from 'fastify';

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (process.env.NODE_ENV === 'production' && !secret) {
    throw new Error('JWT_SECRET é obrigatório em produção.');
  }

  return secret ?? 'dev-secret';
}

export default fp(async (app) => {
  app.register(jwt, {
    secret: getJwtSecret(),
  });

  app.decorate('authenticate', async function (request: FastifyRequest, reply: FastifyReply) {
    try {
      await request.jwtVerify();
    } catch {
      return reply.code(401).send({ message: 'Não autenticado.' });
    }
  });
});
