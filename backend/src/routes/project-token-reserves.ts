import { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { HttpError } from '../lib/http-error.js';
import { auditProjectTokenReserve, getProjectTokenReserveSummary, listAdminProjectTokenReserves, listMyProjectTokenReserves } from '../services/project-token-reserve-service.js';

type AuthRequest = FastifyRequest & { user: { sub: string; roles?: string[] } };

function handleRouteError(reply: { code: (code: number) => { send: (body: { message: string }) => unknown } }, error: unknown) {
  if (error instanceof HttpError) return reply.code(error.statusCode).send({ message: error.message });
  return reply.code(400).send({ message: error instanceof Error ? error.message : 'Erro ao processar reserva de tokens.' });
}

export async function projectTokenReserveRoutes(app: FastifyInstance) {
  app.get('/project-token-reserves/my-projects', { preHandler: [app.authenticate] }, async (request, reply) => {
    try {
      const auth = request as AuthRequest;
      const reserves = await listMyProjectTokenReserves(auth.user.sub);
      return { reserves };
    } catch (error) {
      return handleRouteError(reply, error);
    }
  });

  app.get('/project-token-reserves/companies/:companyId', { preHandler: [app.authenticate] }, async (request, reply) => {
    try {
      const auth = request as AuthRequest;
      const { companyId } = z.object({ companyId: z.string().min(1) }).parse(request.params);
      const summary = await getProjectTokenReserveSummary(companyId, auth.user.sub, auth.user.roles ?? []);
      return summary;
    } catch (error) {
      return handleRouteError(reply, error);
    }
  });

  app.get('/admin/project-token-reserves', { preHandler: [app.authenticate] }, async (request, reply) => {
    try {
      const auth = request as AuthRequest;
      return await listAdminProjectTokenReserves(auth.user.sub, auth.user.roles ?? []);
    } catch (error) {
      return handleRouteError(reply, error);
    }
  });

  app.get('/admin/project-token-reserves/companies/:companyId/audit', { preHandler: [app.authenticate] }, async (request, reply) => {
    try {
      const auth = request as AuthRequest;
      const { companyId } = z.object({ companyId: z.string().min(1) }).parse(request.params);
      const summary = await getProjectTokenReserveSummary(companyId, auth.user.sub, auth.user.roles ?? []);
      return { companyId, inconsistencies: summary.inconsistencies, audit: await auditProjectTokenReserve(companyId) };
    } catch (error) {
      return handleRouteError(reply, error);
    }
  });
}
