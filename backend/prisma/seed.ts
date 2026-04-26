import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const roleKeys = [
    ['USER', 'Usuário comum'],
    ['BUSINESS_OWNER', 'Empresário'],
    ['VIRTUAL_BROKER', 'Corretor virtual'],
    ['AUDITOR', 'Auditor'],
    ['ADMIN', 'Administrador'],
    ['COIN_CHIEF_ADMIN', 'ADM Chefe da Moeda'],
    ['SUPER_ADMIN', 'Super Admin'],
  ];

  for (const [key, name] of roleKeys) {
    await prisma.role.upsert({ where: { key }, update: {}, create: { key, name } });
  }

  const permissionKeys = [
    'auth.login',
    'auth.register',
    'wallet.read',
    'company.create',
    'company.approve',
    'coin.issue',
    'coin.transfer.treasury_to_broker',
    'coin.transfer.broker_to_user',
    'admin.logs.read',
    'admin.dashboard.read',
  ];

  for (const key of permissionKeys) {
    await prisma.permission.upsert({ where: { key }, update: {}, create: { key } });
  }

  const superAdminRole = await prisma.role.findUniqueOrThrow({ where: { key: 'SUPER_ADMIN' } });
  const adminRole = await prisma.role.findUniqueOrThrow({ where: { key: 'ADMIN' } });
  const userRole = await prisma.role.findUniqueOrThrow({ where: { key: 'USER' } });
  const brokerRole = await prisma.role.findUniqueOrThrow({ where: { key: 'VIRTUAL_BROKER' } });
  const coinChiefRole = await prisma.role.findUniqueOrThrow({ where: { key: 'COIN_CHIEF_ADMIN' } });

  const adminEmail = 'admin@bolsavirtual.local';
  const passwordHash = await bcrypt.hash('Admin1234!', 10);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      name: 'Super Admin Inicial',
      email: adminEmail,
      passwordHash,
      wallet: { create: {} },
    },
  });

  await prisma.userRole.upsert({ where: { userId_roleId: { userId: admin.id, roleId: superAdminRole.id } }, update: {}, create: { userId: admin.id, roleId: superAdminRole.id } });
  await prisma.userRole.upsert({ where: { userId_roleId: { userId: admin.id, roleId: adminRole.id } }, update: {}, create: { userId: admin.id, roleId: adminRole.id } });
  await prisma.userRole.upsert({ where: { userId_roleId: { userId: admin.id, roleId: coinChiefRole.id } }, update: {}, create: { userId: admin.id, roleId: coinChiefRole.id } });

  const treasuryExists = await prisma.treasuryAccount.findFirst();
  if (!treasuryExists) {
    await prisma.treasuryAccount.create({ data: {} });
  }

  // usuário base de demonstração
  const userDemo = await prisma.user.upsert({
    where: { email: 'jogador@bolsavirtual.local' },
    update: {},
    create: {
      name: 'Jogador Demo',
      email: 'jogador@bolsavirtual.local',
      passwordHash: await bcrypt.hash('Jogador123!', 10),
      wallet: { create: {} },
    },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: userDemo.id, roleId: userRole.id } },
    update: {},
    create: { userId: userDemo.id, roleId: userRole.id },
  });

  const brokerDemo = await prisma.user.upsert({
    where: { email: 'corretor@bolsavirtual.local' },
    update: {},
    create: {
      name: 'Corretor Demo',
      email: 'corretor@bolsavirtual.local',
      passwordHash: await bcrypt.hash('Corretor123!', 10),
      wallet: { create: {} },
    },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: brokerDemo.id, roleId: brokerRole.id } },
    update: {},
    create: { userId: brokerDemo.id, roleId: brokerRole.id },
  });

  await prisma.brokerAccount.upsert({
    where: { userId: brokerDemo.id },
    update: {},
    create: { userId: brokerDemo.id },
  });

}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
