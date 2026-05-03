import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../lib/prisma.js';
import { ensureCompanyRevenueAccount } from './fee-distribution-service.js';

export class HttpError extends Error { constructor(public statusCode: number, message: string) { super(message); } }

export async function contributeRpcToProject(input: { companyId: string; actorUserId: string; amountRpc: number; reason: string; ip?: string; userAgent?: string | null }) {
  const reason = input.reason.trim();
  if (reason.length < 10) throw new HttpError(400, 'Motivo deve ter ao menos 10 caracteres.');
  const amount = new Decimal(input.amountRpc).toDecimalPlaces(2);
  if (amount.lte(0)) throw new HttpError(400, 'amountRpc deve ser maior que zero.');

  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.$queryRaw`SELECT id FROM "Company" WHERE id = ${input.companyId} FOR UPDATE`;
    const company = await tx.company.findUnique({ where: { id: input.companyId } });
    if (!company) throw new HttpError(404, 'Projeto não encontrado.');
    if (company.founderUserId !== input.actorUserId) throw new HttpError(403, 'Sem permissão para aportar neste projeto.');
    if (company.status !== 'ACTIVE') throw new HttpError(400, 'Projeto precisa estar ACTIVE para receber aporte.');

    const walletBefore = await tx.wallet.findUnique({ where: { userId: input.actorUserId } });
    if (!walletBefore) throw new HttpError(404, 'Carteira não encontrada.');
    const previousWalletRpcBalance = walletBefore.rpcAvailableBalance;

    const debited = await tx.wallet.updateMany({
      where: { userId: input.actorUserId, rpcAvailableBalance: { gte: amount } },
      data: { rpcAvailableBalance: { decrement: amount } },
    });
    if (debited.count !== 1) throw new HttpError(400, 'Saldo RPC insuficiente na carteira.');

    const revenue = await ensureCompanyRevenueAccount(tx, company.id);
    const previousProjectBalance = revenue.balance;
    await tx.companyRevenueAccount.updateMany({ where: { id: revenue.id }, data: { balance: { increment: amount } } });

    const walletAfter = await tx.wallet.findUniqueOrThrow({ where: { userId: input.actorUserId } });
    const revenueAfter = await tx.companyRevenueAccount.findUniqueOrThrow({ where: { id: revenue.id } });

    const entry = await tx.companyCapitalFlowEntry.create({ data: {
      companyId: company.id, actorUserId: input.actorUserId, type: 'OWNER_RPC_CONTRIBUTION', source: 'OWNER_WALLET', amountRpc: amount,
      previousWalletRpcBalance, newWalletRpcBalance: walletAfter.rpcAvailableBalance,
      previousProjectBalance, newProjectBalance: revenueAfter.balance, reason,
      metadata: JSON.stringify({ ip: input.ip ?? null, userAgent: input.userAgent ?? null }),
    } });

    await tx.transaction.create({ data: { walletId: walletBefore.id, type: 'PROJECT_RPC_CONTRIBUTION', amount, description: `Aporte RPC no projeto ${company.ticker}` } });
    await tx.adminLog.create({ data: { userId: input.actorUserId, action: 'PROJECT_RPC_CONTRIBUTION', entity: 'CompanyRevenueAccount', reason, ip: input.ip ?? null, userAgent: input.userAgent ?? null } });

    return { companyId: company.id, amountRpc: amount, previousWalletRpcBalance, newWalletRpcBalance: walletAfter.rpcAvailableBalance, previousProjectBalance, newProjectBalance: revenueAfter.balance, entryId: entry.id };
  });
}
