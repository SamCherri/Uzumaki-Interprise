import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { loginUser, registerUser } from '../services/auth-service.js';

export async function authRoutes(app: FastifyInstance) {
  app.post('/auth/register', async (request: FastifyRequest, reply: FastifyReply) => {
    const schema = z.object({
      name: z.string().min(3),
      email: z.string().email(),
      password: z.string().min(8),
    });

    const body = schema.parse(request.body);

    try {
      const user = await registerUser(body.name, body.email, body.password);
      await app.logAdmin({ action: 'CREATE_ACCOUNT', entity: 'User', userId: user.id, reason: 'Cadastro inicial' });

      return reply.code(201).send({
        id: user.id,
        name: user.name,
        email: user.email,
      });
    } catch (error) {
      return reply.code(400).send({ message: (error as Error).message });
    }
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
