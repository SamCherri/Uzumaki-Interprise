import { CompanyCapitalFlowSource, CompanyCapitalFlowType, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../lib/prisma.js';
import { ensureCompanyRevenueAccount } from './fee-distribution-service.js';
import { HttpError } from '../lib/http-error.js';

const ALLOWED_TYPES = new Set<CompanyCapitalFlowType>(['OWNER_RPC_CONTRIBUTION', 'ADMIN_RPC_ADJUSTMENT', 'PROJECT_REVENUE_IN', 'PROJECT_REVENUE_OUT']);
const ALLOWED_SOURCES = new Set<CompanyCapitalFlowSource>(['OWNER_WALLET', 'ADMIN_ADJUSTMENT', 'MARKET_FEE', 'MANUAL_CORRECTION']);

export async function getProjectInstitutionalAccountSummary(companyId: string) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: {
      revenueAccount: true,
      capitalFlowEntries: { orderBy: { createdAt: 'desc' }, take: 50 },
    },
  });
  if (!company) return null;

  const balance = company.revenueAccount?.balance ?? new Decimal(0);
  const totalsByType: Record<string, number> = {};
  const totalsBySource: Record<string, number> = {};
  const inconsistencies: string[] = [];

  if (balance.lt(0)) inconsistencies.push('CompanyRevenueAccount.balance negativo.');

  for (const entry of company.capitalFlowEntries) {
    const type = entry.type || 'UNKNOWN';
    const source = entry.source || 'UNKNOWN';
    totalsByType[type] = (totalsByType[type] ?? 0) + Number(entry.amountRpc);
    totalsBySource[source] = (totalsBySource[source] ?? 0) + Number(entry.amountRpc);

    if (Number(entry.amountRpc) <= 0) inconsistencies.push(`Entry ${entry.id} com amountRpc <= 0.`);
    if (!entry.reason?.trim()) inconsistencies.push(`Entry ${entry.id} sem reason.`);
    if (!entry.actorUserId) inconsistencies.push(`Entry ${entry.id} sem actorUserId.`);
    if (!entry.source) inconsistencies.push(`Entry ${entry.id} sem source.`);
    if (!entry.type) inconsistencies.push(`Entry ${entry.id} sem type.`);
    if (Number(entry.newProjectBalance) < 0) inconsistencies.push(`Entry ${entry.id} com newProjectBalance negativo.`);
  }

  return { company, balance, entries: company.capitalFlowEntries, totalsByType, totalsBySource, inconsistencies };
}

export async function recordProjectInstitutionalEntry(
  tx: Prisma.TransactionClient,
  input: { companyId: string; actorUserId: string; amountRpc: Decimal; reason: string; type: CompanyCapitalFlowType; source: CompanyCapitalFlowSource; previousWalletRpcBalance?: Decimal; newWalletRpcBalance?: Decimal; metadata?: string | null },
) {
  if (input.amountRpc.lte(0)) throw new HttpError(400, 'amountRpc deve ser maior que zero.');
  if (!input.reason.trim()) throw new HttpError(400, 'reason é obrigatório.');
  if (!ALLOWED_TYPES.has(input.type)) throw new HttpError(400, 'type inválido para caixa institucional.');
  if (!ALLOWED_SOURCES.has(input.source)) throw new HttpError(400, 'source inválido para caixa institucional.');

  const revenue = await ensureCompanyRevenueAccount(tx, input.companyId);
  if (revenue.balance.lt(0)) throw new HttpError(400, 'Saldo institucional inválido.');

  const previousProjectBalance = revenue.balance;
  await tx.companyRevenueAccount.update({ where: { id: revenue.id }, data: { balance: { increment: input.amountRpc } } });
  const revenueAfter = await tx.companyRevenueAccount.findUniqueOrThrow({ where: { id: revenue.id } });

  return tx.companyCapitalFlowEntry.create({
    data: {
      companyId: input.companyId,
      actorUserId: input.actorUserId,
      type: input.type,
      source: input.source,
      amountRpc: input.amountRpc,
      previousProjectBalance,
      newProjectBalance: revenueAfter.balance,
      previousWalletRpcBalance: input.previousWalletRpcBalance ?? new Decimal(0),
      newWalletRpcBalance: input.newWalletRpcBalance ?? new Decimal(0),
      reason: input.reason.trim(),
      metadata: input.metadata ?? null,
    },
  });
}
