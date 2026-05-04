import { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { auditProjectTokenReserve, getProjectTokenReserveSummary, listAdminProjectTokenReserves, listMyProjectTokenReserves } from '../services/project-token-reserve-service.js';

type AuthRequest = FastifyRequest & { user: { sub: string; roles?: string[] } };

export async function projectTokenReserveRoutes(app: FastifyInstance) {
  app.get('/project-token-reserves/my-projects', { preHandler: [app.authenticate] }, async (request) => {
    const auth = request as AuthRequest;
    const reserves = await listMyProjectTokenReserves(auth.user.sub);
    return { reserves };
  });

  app.get('/project-token-reserves/companies/:companyId', { preHandler: [app.authenticate] }, async (request) => {
    const auth = request as AuthRequest;
    const { companyId } = z.object({ companyId: z.string().min(1) }).parse(request.params);
    const summary = await getProjectTokenReserveSummary(companyId, auth.user.sub, auth.user.roles ?? []);
    return summary;
  });

  app.get('/admin/project-token-reserves', { preHandler: [app.authenticate] }, async (request) => {
    const auth = request as AuthRequest;
    return listAdminProjectTokenReserves(auth.user.sub, auth.user.roles ?? []);
  });

  app.get('/admin/project-token-reserves/companies/:companyId/audit', { preHandler: [app.authenticate] }, async (request) => {
    const auth = request as AuthRequest;
    const { companyId } = z.object({ companyId: z.string().min(1) }).parse(request.params);
    const summary = await getProjectTokenReserveSummary(companyId, auth.user.sub, auth.user.roles ?? []);
    return { companyId, inconsistencies: summary.inconsistencies, audit: await auditProjectTokenReserve(companyId) };
  });
}
