import fp from 'fastify-plugin';
import jwt from '@fastify/jwt';
import { FastifyReply, FastifyRequest } from 'fastify';

export default fp(async (app) => {
  app.register(jwt, {
    secret: process.env.JWT_SECRET ?? 'dev-secret',
  });

  app.decorate('authenticate', async function (request: FastifyRequest, reply: FastifyReply) {
    try {
      await request.jwtVerify();
    } catch {
      return reply.code(401).send({ message: 'Não autenticado.' });
    }
  });
});
