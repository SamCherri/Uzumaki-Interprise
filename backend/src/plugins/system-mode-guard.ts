import { FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from '../lib/prisma.js';

export const SYSTEM_MODE_ID = 'SYSTEM_MODE_MAIN';

const ADMIN_ROLES = new Set(['ADMIN', 'SUPER_ADMIN', 'COIN_CHIEF_ADMIN']);
const ALLOWED_PREFIXES = ['/api/auth/login', '/api/auth/register', '/api/auth/me', '/api/system-mode', '/api/test-mode', '/api/admin'];

export async function ensureSystemModeConfig() {
  return prisma.systemModeConfig.upsert({ where: { id: SYSTEM_MODE_ID }, update: {}, create: { id: SYSTEM_MODE_ID, mode: 'NORMAL' } });
}

export function isAdminRole(roles: string[]) { return roles.some((role) => ADMIN_ROLES.has(role.toUpperCase())); }

export async function assertTestMode(reply: FastifyReply) {
  const mode = await ensureSystemModeConfig();
  if (mode.mode !== 'TEST') { reply.status(403).send({ message: 'Modo Teste não está ativo.' }); return false; }
  return true;
}

export async function globalSystemModeGuard(request: FastifyRequest, reply: FastifyReply) {
  const config = await ensureSystemModeConfig();
  if (config.mode !== 'TEST') return;
  if (ALLOWED_PREFIXES.some((prefix) => request.url.startsWith(prefix))) return;

  try {
    await request.jwtVerify();
  } catch {
    return reply.status(403).send({ message: 'O site está em Modo Teste. Esta área está temporariamente desabilitada.' });
  }

  const roles = ((request.user as { roles?: string[] } | undefined)?.roles ?? []).map((r) => r.toUpperCase());
  if (isAdminRole(roles)) return;
  return reply.status(403).send({ message: 'O site está em Modo Teste. Esta área está temporariamente desabilitada.' });
}
