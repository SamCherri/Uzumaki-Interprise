import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';

export async function registerUser(name: string, email: string, password: string) {
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) {
    throw new Error('E-mail já cadastrado.');
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const userRole = await prisma.role.findUnique({ where: { key: 'USER' } });
  if (!userRole) {
    throw new Error('Cargo USER não encontrado no seed.');
  }

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      wallet: { create: {} },
      roles: { create: [{ roleId: userRole.id }] },
    },
    include: { roles: { include: { role: true } } },
  });

  return user;
}

export async function loginUser(email: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    include: { roles: { include: { role: true } }, wallet: true },
  });

  if (!user) {
    throw new Error('Credenciais inválidas.');
  }

  if (user.isBlocked) {
    throw new Error('Usuário bloqueado pela administração.');
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new Error('Credenciais inválidas.');
  }

  return user;
}
