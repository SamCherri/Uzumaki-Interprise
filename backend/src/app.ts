import Fastify from 'fastify';
import cors from '@fastify/cors';
import { FastifyReply, FastifyRequest } from 'fastify';
import authPlugin from './plugins/auth.js';
import { authRoutes } from './routes/auth.js';
import { userRoutes } from './routes/user.js';
import { adminRoutes } from './routes/admin.js';
import { brokerRoutes } from './routes/broker.js';
import { companyRoutes } from './routes/companies.js';
import { marketRoutes } from './routes/market.js';
import { withdrawalsRoutes } from './routes/withdrawals.js';
import { prisma } from './lib/prisma.js';
import { adminUsersRoutes } from './routes/admin-users.js';
import { adminTokensRoutes } from './routes/admin-tokens.js';
import { adminAuditRoutes } from './routes/admin-audit.js';
import { projectBoostRoutes } from './routes/project-boosts.js';
import { rpcMarketRoutes } from './routes/rpc-market.js';
import { systemModeRoutes } from './routes/system-mode.js';
import { testModeRoutes } from './routes/test-mode.js';

export function buildApp() {
  const app = Fastify({ logger: true });

  const webOrigin = process.env.WEB_ORIGIN;
  app.register(cors, {
    origin: webOrigin ? webOrigin.split(',').map((origin: string) => origin.trim()) : true,
    credentials: true,
  });
  app.register(authPlugin);

  app.decorate('logAdmin', async (input: { action: string; entity: string; userId?: string; reason?: string; previous?: string; current?: string }) => {
    await prisma.adminLog.create({
      data: {
        action: input.action,
        entity: input.entity,
        userId: input.userId,
        reason: input.reason,
        previous: input.previous,
        current: input.current,
      },
    });
  });

  app.get('/health', async () => ({ status: 'ok' }));
  app.register(authRoutes, { prefix: '/api' });
  app.register(userRoutes, { prefix: '/api' });
  app.register(adminRoutes, { prefix: '/api' });
  app.register(brokerRoutes, { prefix: '/api' });
  app.register(companyRoutes, { prefix: '/api' });
  app.register(marketRoutes, { prefix: '/api' });
  app.register(withdrawalsRoutes, { prefix: '/api' });
  app.register(adminUsersRoutes, { prefix: '/api/admin' });
  app.register(adminTokensRoutes, { prefix: '/api/admin' });
  app.register(adminAuditRoutes, { prefix: '/api/admin' });
  app.register(projectBoostRoutes, { prefix: '/api' });
  app.register(rpcMarketRoutes, { prefix: '/api' });
  app.register(systemModeRoutes, { prefix: '/api' });
  app.register(testModeRoutes, { prefix: '/api' });

  return app;
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    logAdmin: (request: { action: string; entity: string; userId?: string; reason?: string; previous?: string; current?: string }) => Promise<void>;
  }
}
