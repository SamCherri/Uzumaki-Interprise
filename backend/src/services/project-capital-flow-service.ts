import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../lib/prisma.js';
import { ensureCompanyRevenueAccount } from './fee-distribution-service.js';

const ADMIN_ROLES = ['ADMIN', 'SUPER_ADMIN', 'COIN_CHIEF_ADMIN'];

export async function contributeRpcToProject(input: { companyId: string; actorUserId: string; amountRpc: number; reason: string; ip?: string; userAgent?: string | null; actorRoles?: string[] }) {
  const reason = input.reason.trim();
  if (reason.length < 10) throw new Error('Motivo deve ter ao menos 10 caracteres.');
  const amount = new Decimal(input.amountRpc).toDecimalPlaces(2);
  if (amount.lte(0)) throw new Error('amountRpc deve ser maior que zero.');

  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.$queryRaw`SELECT id FROM "Company" WHERE id = ${input.companyId} FOR UPDATE`;
    const company = await tx.company.findUniqueOrThrow({ where: { id: input.companyId } });
    if (company.status !== 'ACTIVE') throw new Error('Projeto precisa estar ACTIVE para receber aporte.');

    const isAdmin = (input.actorRoles ?? []).some((role) => ADMIN_ROLES.includes(role.toUpperCase()));
    if (!isAdmin && company.founderUserId !== input.actorUserId) throw new Error('Sem permissão para aportar neste projeto.');

    const wallet = await tx.wallet.findUnique({ where: { userId: input.actorUserId } });
    if (!wallet) throw new Error('Carteira não encontrada.');
    if (wallet.rpcAvailableBalance.lt(amount)) throw new Error('Saldo RPC insuficiente na carteira.');

    const revenue = await ensureCompanyRevenueAccount(tx, company.id);

    const previousWalletRpcBalance = wallet.rpcAvailableBalance;
    const newWalletRpcBalance = previousWalletRpcBalance.sub(amount).toDecimalPlaces(2);
    const previousProjectBalance = revenue.balance;
    const newProjectBalance = previousProjectBalance.add(amount).toDecimalPlaces(2);

    if (newWalletRpcBalance.lt(0)) throw new Error('Operação inválida: saldo RPC negativo.');

    await tx.wallet.update({ where: { id: wallet.id }, data: { rpcAvailableBalance: newWalletRpcBalance } });
    await tx.companyRevenueAccount.update({ where: { id: revenue.id }, data: { balance: newProjectBalance } });

    const entry = await tx.companyCapitalFlowEntry.create({ data: {
      companyId: company.id, actorUserId: input.actorUserId, type: isAdmin ? 'ADMIN_RPC_ADJUSTMENT' : 'OWNER_RPC_CONTRIBUTION', source: isAdmin ? 'ADMIN_ADJUSTMENT' : 'OWNER_WALLET', amountRpc: amount,
      previousWalletRpcBalance, newWalletRpcBalance, previousProjectBalance, newProjectBalance, reason,
      metadata: JSON.stringify({ ip: input.ip ?? null, userAgent: input.userAgent ?? null }),
    } });

    await tx.transaction.create({ data: { walletId: wallet.id, type: 'PROJECT_RPC_CONTRIBUTION', amount, description: `Aporte RPC no projeto ${company.ticker}` } });
    await tx.adminLog.create({ data: { userId: input.actorUserId, action: 'PROJECT_RPC_CONTRIBUTION', entity: 'CompanyRevenueAccount', reason, ip: input.ip ?? null, userAgent: input.userAgent ?? null, previous: JSON.stringify({ companyId: company.id, walletRpc: previousWalletRpcBalance.toString(), projectBalance: previousProjectBalance.toString() }), current: JSON.stringify({ companyId: company.id, walletRpc: newWalletRpcBalance.toString(), projectBalance: newProjectBalance.toString(), amountRpc: amount.toString(), entryId: entry.id }) } });

    return { companyId: company.id, amountRpc: amount, previousWalletRpcBalance, newWalletRpcBalance, previousProjectBalance, newProjectBalance, entryId: entry.id };
  });
}
