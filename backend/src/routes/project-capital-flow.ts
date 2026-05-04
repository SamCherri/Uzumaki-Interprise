import { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { contributeRpcToProject } from '../services/project-capital-flow-service.js';
import { HttpError } from '../lib/http-error.js';
import { getProjectInstitutionalAccountSummary } from '../services/project-institutional-account-service.js';

type AuthRequest = FastifyRequest & { user: { sub: string; roles?: string[] } };
const ADMIN_ROLES = ['SUPER_ADMIN', 'COIN_CHIEF_ADMIN', 'AUDITOR'];
const isAdmin = (roles: string[]) => roles.some((r) => ADMIN_ROLES.includes(r));

export async function projectCapitalFlowRoutes(app: FastifyInstance) {
  app.get('/project-capital-flow/my-projects', { preHandler: [app.authenticate] }, async (request) => {
    const auth = request as AuthRequest;
    const wallet = await prisma.wallet.findUnique({ where: { userId: auth.user.sub } });
    const companies = await prisma.company.findMany({ where: { founderUserId: auth.user.sub, status: 'ACTIVE' }, include: { revenueAccount: true, boostAccount: true, capitalFlowEntries: { orderBy: { createdAt: 'desc' }, take: 10 } } });
    return { walletRpcAvailableBalance: wallet?.rpcAvailableBalance ?? 0, companies };
  });

  app.get('/project-capital-flow/companies/:companyId', { preHandler: [app.authenticate] }, async (request, reply) => {
    const auth = request as AuthRequest;
    try {
      const { companyId } = z.object({ companyId: z.string().min(1) }).parse(request.params);
      const summary = await getProjectInstitutionalAccountSummary(companyId);
      if (!summary) return reply.code(404).send({ message: 'Projeto não encontrado.' });
      if (summary.company.founderUserId !== auth.user.sub && !isAdmin((auth.user.roles ?? []).map((r) => r.toUpperCase()))) return reply.code(403).send({ message: 'Sem permissão.' });
      return {
        companyId: summary.company.id,
        ticker: summary.company.ticker,
        companyName: summary.company.name,
        institutionalBalance: summary.balance,
        entries: summary.entries,
        totalsByType: summary.totalsByType,
        totalsBySource: summary.totalsBySource,
        inconsistencies: summary.inconsistencies,
      };
    } catch (error) {
      return reply.code(400).send({ message: (error as Error).message });
    }
  });

  app.post('/project-capital-flow/companies/:companyId/contribute', { preHandler: [app.authenticate] }, async (request, reply) => {
    const auth = request as AuthRequest;
    try {
      const { companyId } = z.object({ companyId: z.string().min(1) }).parse(request.params);
      const body = z.object({ amountRpc: z.coerce.number(), reason: z.string() }).parse(request.body);
      const result = await contributeRpcToProject({ companyId, actorUserId: auth.user.sub, amountRpc: body.amountRpc, reason: body.reason, ip: request.ip, userAgent: request.headers['user-agent'] ?? null });
      return result;
    } catch (error) {
      if (error instanceof HttpError) return reply.code(error.statusCode).send({ message: error.message });
      return reply.code(400).send({ message: (error as Error).message });
    }
  });
}
