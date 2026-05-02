import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';

export async function assertAdminPassword(userId: string, adminPassword?: string) {
  if (!adminPassword) throw new Error('Confirme sua senha para continuar.');
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
  if (!user?.passwordHash) throw new Error('Senha administrativa inválida.');
  const ok = await bcrypt.compare(adminPassword, user.passwordHash);
  if (!ok) throw new Error('Senha administrativa inválida.');
}
