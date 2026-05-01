import test from 'node:test';
import assert from 'node:assert/strict';

if (!process.env.TEST_DATABASE_URL) throw new Error('TEST_DATABASE_URL é obrigatório para testes de integração.');
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

const [{ buildApp }, { prisma }] = await Promise.all([
  import('../src/app.js'),
  import('../src/lib/prisma.js'),
]);

async function resetDb() {
  await prisma.userRole.deleteMany();
  await prisma.role.deleteMany();
  await prisma.wallet.deleteMany();
  await prisma.user.deleteMany();
}

test('JWT_SECRET obrigatório em produção', async () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalJwt = process.env.JWT_SECRET;
  process.env.NODE_ENV = 'production';
  delete process.env.JWT_SECRET;
  const app = buildApp();
  await assert.rejects(() => app.ready(), /JWT_SECRET é obrigatório em produção/);
  process.env.NODE_ENV = originalNodeEnv;
  process.env.JWT_SECRET = originalJwt;
});

test('WEB_ORIGIN obrigatório em produção', async () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalJwt = process.env.JWT_SECRET;
  const originalWeb = process.env.WEB_ORIGIN;
  process.env.NODE_ENV = 'production';
  process.env.JWT_SECRET = 'secret';
  process.env.WEB_ORIGIN = '   ';
  assert.throws(() => buildApp(), /WEB_ORIGIN é obrigatório em produção/);
  process.env.NODE_ENV = originalNodeEnv;
  process.env.JWT_SECRET = originalJwt;
  process.env.WEB_ORIGIN = originalWeb;
});

test('login inválido bloqueia temporariamente e login válido zera contador', async () => {
  process.env.NODE_ENV = 'test';
  const app = buildApp();
  await app.ready();
  await resetDb();

  const role = await prisma.role.create({ data: { key: 'USER', name: 'USER' } });
  const ok = await app.inject({ method: 'POST', url: '/api/auth/register', payload: { name: 'User Teste', characterName: 'Personagem', bankAccountNumber: '12345', email: 'lock@test.local', password: '12345678' } });
  assert.equal(ok.statusCode, 201, ok.body);
  const user = await prisma.user.findUniqueOrThrow({ where: { email: 'lock@test.local' } });
  await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });

  for (let i = 0; i < 4; i++) {
    const bad = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'lock@test.local', password: 'senha-errada' } });
    assert.equal(bad.statusCode, 401);
    assert.equal(bad.json().message, 'Credenciais inválidas.');
  }

  const locked = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'lock@test.local', password: 'senha-errada' } });
  assert.equal(locked.statusCode, 401);
  assert.equal(locked.json().message, 'Muitas tentativas inválidas. Tente novamente mais tarde.');

  const unlockedNow = await prisma.user.update({ where: { id: user.id }, data: { loginLockedUntil: new Date(Date.now() - 1000) } });
  assert.ok(unlockedNow);

  const success = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'lock@test.local', password: '12345678' } });
  assert.equal(success.statusCode, 200, success.body);

  const refreshed = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  assert.equal(refreshed.failedLoginAttempts, 0);
  assert.equal(refreshed.loginLockedUntil, null);

  await app.close();
});
