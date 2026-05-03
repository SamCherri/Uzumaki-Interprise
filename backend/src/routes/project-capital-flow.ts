import { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { contributeRpcToProject } from '../services/project-capital-flow-service.js';

type AuthRequest = FastifyRequest & { user: { sub: string; roles?: string[] } };
const ADMIN_ROLES = ['ADMIN', 'SUPER_ADMIN', 'COIN_CHIEF_ADMIN'];

const isAdmin = (roles: string[]) => roles.some((r) => ADMIN_ROLES.includes(r));

export async function projectCapitalFlowRoutes(app: FastifyInstance) {
  app.get('/project-capital-flow/my-projects', { preHandler: [app.authenticate] }, async (request) => {
    const auth = request as AuthRequest;
    const companies = await prisma.company.findMany({ where: { founderUserId: auth.user.sub }, include: { revenueAccount: true, capitalFlowEntries: { orderBy: { createdAt: 'desc' }, take: 10 } } });
    return { companies };
  });

  app.get('/project-capital-flow/companies/:companyId', { preHandler: [app.authenticate] }, async (request, reply) => {
    const auth = request as AuthRequest;
    const { companyId } = z.object({ companyId: z.string().min(1) }).parse(request.params);
    const company = await prisma.company.findUniqueOrThrow({ where: { id: companyId }, include: { revenueAccount: true, capitalFlowEntries: { orderBy: { createdAt: 'desc' }, take: 50 } } });
    if (company.founderUserId !== auth.user.sub && !isAdmin((auth.user.roles ?? []).map((r) => r.toUpperCase()))) return reply.code(403).send({ message: 'Sem permissão.' });
    return { company };
  });

  app.post('/project-capital-flow/companies/:companyId/contribute', { preHandler: [app.authenticate] }, async (request, reply) => {
    const auth = request as AuthRequest;
    try {
      const { companyId } = z.object({ companyId: z.string().min(1) }).parse(request.params);
      const body = z.object({ amountRpc: z.coerce.number().positive(), reason: z.string().min(10) }).parse(request.body);
      const result = await contributeRpcToProject({ companyId, actorUserId: auth.user.sub, amountRpc: body.amountRpc, reason: body.reason, ip: request.ip, userAgent: request.headers['user-agent'] ?? null, actorRoles: auth.user.roles ?? [] });
      return result;
    } catch (error) {
      return reply.code(400).send({ message: (error as Error).message });
    }
  });
}
