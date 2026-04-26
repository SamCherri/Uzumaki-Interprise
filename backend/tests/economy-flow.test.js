import test from 'node:test';
import assert from 'node:assert/strict';

function issueToTreasury(current, amount) {
  if (amount <= 0) throw new Error('invalid_amount');
  return current + amount;
}

function transferTreasuryToBroker(treasury, amount) {
  if (amount <= 0) throw new Error('invalid_amount');
  if (treasury < amount) throw new Error('insufficient_treasury');
  return treasury - amount;
}

function transferBrokerToUser(broker, amount) {
  if (amount <= 0) throw new Error('invalid_amount');
  if (broker < amount) throw new Error('insufficient_broker');
  return broker - amount;
}

function canAccessAdmin(role) {
  return ['ADMIN', 'SUPER_ADMIN', 'COIN_CHIEF_ADMIN'].includes(role);
}

test('ADM Chefe cria moeda para tesouraria', () => {
  const next = issueToTreasury(100, 50);
  assert.equal(next, 150);
});

test('Tesouraria envia moeda para corretor', () => {
  const next = transferTreasuryToBroker(200, 80);
  assert.equal(next, 120);
});

test('Corretor envia moeda para usuário', () => {
  const next = transferBrokerToUser(90, 40);
  assert.equal(next, 50);
});

test('Tentativa de saldo negativo falha', () => {
  assert.throws(() => transferBrokerToUser(10, 20), /insufficient_broker/);
});

test('Usuário comum sem acesso admin', () => {
  assert.equal(canAccessAdmin('USER'), false);
});
