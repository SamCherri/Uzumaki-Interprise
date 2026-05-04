import { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { HttpError } from '../lib/http-error.js';
import { cancelBuybackProgram, createBuybackProgram, executeBuybackProgram } from '../services/project-buyback-service.js';

type AuthRequest = FastifyRequest & { user: { sub: string; roles?: string[] } };

export async function projectBuybackRoutes(app: FastifyInstance) {
  app.get('/project-buybacks/my-projects', { preHandler: [app.authenticate] }, async (request) => {
    const auth = request as AuthRequest;
    const companies = await prisma.company.findMany({ where: { founderUserId: auth.user.sub, status: 'ACTIVE' }, include: { revenueAccount: true, buybackPrograms: { orderBy: { createdAt: 'desc' }, take: 10 }, tokenReserve: true } });
    return { companies };
  });

  app.get('/project-buybacks/companies/:companyId', { preHandler: [app.authenticate] }, async (request, reply) => {
    const auth = request as AuthRequest;
    const { companyId } = z.object({ companyId: z.string().min(1) }).parse(request.params);
    const company = await prisma.company.findUnique({ where: { id: companyId } });
    if (!company) return reply.code(404).send({ message: 'Projeto não encontrado.' });
    if (company.founderUserId !== auth.user.sub) return reply.code(403).send({ message: 'Sem permissão.' });
    const programs = await prisma.projectBuybackProgram.findMany({ where: { companyId }, orderBy: { createdAt: 'desc' }, include: { executions: true } });
    return { companyId, programs };
  });

  app.post('/project-buybacks/companies/:companyId/programs', { preHandler: [app.authenticate] }, async (request, reply) => {
    const auth = request as AuthRequest;
    try {
      const { companyId } = z.object({ companyId: z.string().min(1) }).parse(request.params);
      const body = z.object({ budgetRpc: z.coerce.number(), maxPricePerShare: z.coerce.number(), targetShares: z.coerce.number().int(), reason: z.string(), expiresAt: z.string().optional() }).parse(request.body);
      const program = await createBuybackProgram({ companyId, actorUserId: auth.user.sub, actorRoles: auth.user.roles ?? [], ...body, ip: request.ip, userAgent: request.headers['user-agent'] ?? null });
      return reply.code(201).send(program);
    } catch (e) {
      if (e instanceof HttpError) return reply.code(e.statusCode).send({ message: e.message });
      return reply.code(400).send({ message: (e as Error).message });
    }
  });

  app.post('/project-buybacks/programs/:programId/execute', { preHandler: [app.authenticate] }, async (request, reply) => {
    const auth = request as AuthRequest;
    try {
      const { programId } = z.object({ programId: z.string().min(1) }).parse(request.params);
      const body = z.object({ maxExecutions: z.coerce.number().int().positive().optional() }).optional().parse(request.body ?? {});
      return await executeBuybackProgram({ programId, actorUserId: auth.user.sub, actorRoles: auth.user.roles ?? [], maxExecutions: body?.maxExecutions, ip: request.ip, userAgent: request.headers['user-agent'] ?? null });
    } catch (e) {
      if (e instanceof HttpError) return reply.code(e.statusCode).send({ message: e.message });
      return reply.code(400).send({ message: (e as Error).message });
    }
  });

  app.post('/project-buybacks/programs/:programId/cancel', { preHandler: [app.authenticate] }, async (request, reply) => {
    const auth = request as AuthRequest;
    try {
      const { programId } = z.object({ programId: z.string().min(1) }).parse(request.params);
      return await cancelBuybackProgram({ programId, actorUserId: auth.user.sub, actorRoles: auth.user.roles ?? [], ip: request.ip, userAgent: request.headers['user-agent'] ?? null });
    } catch (e) {
      if (e instanceof HttpError) return reply.code(e.statusCode).send({ message: e.message });
      return reply.code(400).send({ message: (e as Error).message });
    }
  });
}
