import fp from 'fastify-plugin';
import jwt from '@fastify/jwt';

export default fp(async (app) => {
  app.register(jwt, {
    secret: process.env.JWT_SECRET ?? 'dev-secret',
  });

  app.decorate('authenticate', async function (request: any, reply: any) {
    try {
      await request.jwtVerify();
    } catch {
      return reply.code(401).send({ message: 'Não autenticado.' });
    }
  });
});
