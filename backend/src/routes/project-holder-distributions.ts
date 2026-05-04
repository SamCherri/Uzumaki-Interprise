import { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { HttpError } from '../lib/http-error.js';
import { cancelHolderDistributionProgram, createHolderDistributionProgram, executeHolderDistributionProgram, getHolderDistributionProgramSummary, listAdminHolderDistributions, listMyProjectHolderDistributions } from '../services/project-holder-distribution-service.js';

type AuthRequest = FastifyRequest & { user: { sub: string; roles?: string[] } };

function handle(reply: { code: (c: number) => { send: (b: { message: string }) => unknown } }, e: unknown) {
  if (e instanceof HttpError) return reply.code(e.statusCode).send({ message: e.message });
  return reply.code(400).send({ message: e instanceof Error ? e.message : 'Erro' });
}

export async function projectHolderDistributionRoutes(app: FastifyInstance) {
  app.get('/project-holder-distributions/my-projects', { preHandler: [app.authenticate] }, async (request, reply) => {
    try { const auth = request as AuthRequest; return { programs: await listMyProjectHolderDistributions(auth.user.sub) }; } catch (e) { return handle(reply, e); }
  });

  app.get('/project-holder-distributions/companies/:companyId', { preHandler: [app.authenticate] }, async (request, reply) => {
    try { const auth = request as AuthRequest; const { companyId } = z.object({ companyId: z.string().min(1) }).parse(request.params); return { companyId, programs: await getHolderDistributionProgramSummary(companyId, auth.user.sub, auth.user.roles ?? []) }; } catch (e) { return handle(reply, e); }
  });

  app.post('/project-holder-distributions/companies/:companyId/programs', { preHandler: [app.authenticate] }, async (request, reply) => {
    try { const auth = request as AuthRequest; const { companyId } = z.object({ companyId: z.string().min(1) }).parse(request.params); const body = z.object({ budgetRpc: z.coerce.number(), reason: z.string(), excludeFounder: z.boolean().optional() }).parse(request.body); const program = await createHolderDistributionProgram({ companyId, actorUserId: auth.user.sub, actorRoles: auth.user.roles ?? [], budgetRpc: body.budgetRpc, reason: body.reason, excludeFounder: body.excludeFounder, ip: request.ip, userAgent: request.headers['user-agent'] ?? null }); return reply.code(201).send(program); } catch (e) { return handle(reply, e); }
  });

  app.post('/project-holder-distributions/programs/:programId/execute', { preHandler: [app.authenticate] }, async (request, reply) => {
    try { const auth = request as AuthRequest; const { programId } = z.object({ programId: z.string().min(1) }).parse(request.params); return await executeHolderDistributionProgram({ programId, actorUserId: auth.user.sub, actorRoles: auth.user.roles ?? [], ip: request.ip, userAgent: request.headers['user-agent'] ?? null }); } catch (e) { return handle(reply, e); }
  });

  app.post('/project-holder-distributions/programs/:programId/cancel', { preHandler: [app.authenticate] }, async (request, reply) => {
    try { const auth = request as AuthRequest; const { programId } = z.object({ programId: z.string().min(1) }).parse(request.params); return await cancelHolderDistributionProgram({ programId, actorUserId: auth.user.sub, actorRoles: auth.user.roles ?? [], ip: request.ip, userAgent: request.headers['user-agent'] ?? null }); } catch (e) { return handle(reply, e); }
  });

  app.get('/admin/project-holder-distributions', { preHandler: [app.authenticate] }, async (request, reply) => {
    try { const auth = request as AuthRequest; return { programs: await listAdminHolderDistributions(auth.user.roles ?? []) }; } catch (e) { return handle(reply, e); }
  });
}
