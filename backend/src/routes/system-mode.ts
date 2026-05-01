import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ensureSystemModeConfig, isAdminRole, SYSTEM_MODE_ID } from '../plugins/system-mode-guard.js';
import { prisma } from '../lib/prisma.js';

const CONTROL_ROLES = new Set(['SUPER_ADMIN', 'COIN_CHIEF_ADMIN']);

function hasControlRole(roles: string[]) {
  return roles.some((role) => CONTROL_ROLES.has(role.toUpperCase()));
}

export async function systemModeRoutes(app: FastifyInstance) {
  app.get('/system-mode', async () => ensureSystemModeConfig());

  app.get('/admin/system-mode', { preHandler: [app.authenticate] }, async (request, reply) => {
    const roles = ((request.user as { roles?: string[] }).roles ?? []);
    if (!isAdminRole(roles)) return reply.status(403).send({ message: 'Sem permissão.' });
    return ensureSystemModeConfig();
  });

  app.post('/admin/system-mode/test/enable', { preHandler: [app.authenticate] }, async (request, reply) => {
    const roles = ((request.user as { roles?: string[] }).roles ?? []);
    if (!hasControlRole(roles)) return reply.status(403).send({ message: 'Sem permissão.' });
    const body = z.object({ testTitle: z.string().optional(), testDescription: z.string().optional(), reason: z.string().min(10) }).parse(request.body ?? {});
    const previous = await ensureSystemModeConfig();
    const current = await prisma.systemModeConfig.upsert({ where: { id: SYSTEM_MODE_ID }, update: { mode: 'TEST', testTitle: body.testTitle, testDescription: body.testDescription, testEnabledAt: new Date() }, create: { id: SYSTEM_MODE_ID, mode: 'TEST', testTitle: body.testTitle, testDescription: body.testDescription, testEnabledAt: new Date() } });
    await app.logAdmin({ userId: (request.user as { sub: string }).sub, action: 'SYSTEM_MODE_ENABLE_TEST', entity: 'SystemModeConfig', reason: body.reason, previous: JSON.stringify(previous), current: JSON.stringify(current) });
    return { message: 'Modo TEST ativado.', config: current };
  });

  app.post('/admin/system-mode/normal/enable', { preHandler: [app.authenticate] }, async (request, reply) => {
    const roles = ((request.user as { roles?: string[] }).roles ?? []);
    if (!hasControlRole(roles)) return reply.status(403).send({ message: 'Sem permissão.' });
    const body = z.object({ reason: z.string().min(10) }).parse(request.body ?? {});
    const previous = await ensureSystemModeConfig();
    const current = await prisma.systemModeConfig.update({ where: { id: SYSTEM_MODE_ID }, data: { mode: 'NORMAL', testDisabledAt: new Date(), testDisabledReason: body.reason } });
    await app.logAdmin({ userId: (request.user as { sub: string }).sub, action: 'SYSTEM_MODE_ENABLE_NORMAL', entity: 'SystemModeConfig', reason: body.reason, previous: JSON.stringify(previous), current: JSON.stringify(current) });
    return { message: 'Modo NORMAL ativado.', config: current };
  });
}
