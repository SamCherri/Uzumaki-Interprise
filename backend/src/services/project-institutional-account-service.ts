import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../lib/prisma.js';
import { ensureCompanyRevenueAccount } from './fee-distribution-service.js';

type Tx = Prisma.TransactionClient;

export async function getProjectInstitutionalAccountSummary(companyId: string) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: {
      revenueAccount: true,
      capitalFlowEntries: { orderBy: { createdAt: 'desc' }, take: 50 },
    },
  });
  if (!company) throw new Error('Projeto não encontrado.');
  const balance = Number(company.revenueAccount?.balance ?? 0);
  const entries = company.capitalFlowEntries;
  const totalsByType: Record<string, number> = {};
  const totalsBySource: Record<string, number> = {};
  for (const e of entries) {
    totalsByType[e.type] = (totalsByType[e.type] ?? 0) + Number(e.amountRpc);
    totalsBySource[e.source] = (totalsBySource[e.source] ?? 0) + Number(e.amountRpc);
  }
  const inconsistencies: string[] = [];
  if (balance < 0) inconsistencies.push('Saldo institucional negativo.');
  if (entries.some((e: (typeof entries)[number]) => Number(e.amountRpc) <= 0)) inconsistencies.push('Entrada com amountRpc <= 0.');
  if (entries.some((e: (typeof entries)[number]) => !e.reason?.trim())) inconsistencies.push('Entrada sem motivo.');
  return { company, balance, entries, totalsByType, totalsBySource, inconsistencies };
}

export async function recordProjectInstitutionalEntry(tx: Tx, input: {
  companyId: string;
  actorUserId: string;
  amountRpc: Decimal;
  reason: string;
  source: 'OWNER_WALLET' | 'ADMIN_ADJUSTMENT' | 'MARKET_FEE' | 'MANUAL_CORRECTION';
  type: 'OWNER_RPC_CONTRIBUTION' | 'ADMIN_RPC_ADJUSTMENT' | 'PROJECT_REVENUE_IN';
  previousWalletRpcBalance: Decimal;
  newWalletRpcBalance: Decimal;
  ip?: string | null;
  userAgent?: string | null;
}) {
  if (input.amountRpc.lte(0)) throw new Error('amountRpc deve ser maior que zero.');
  if (!input.reason.trim()) throw new Error('Motivo é obrigatório.');
  const revenue = await ensureCompanyRevenueAccount(tx, input.companyId);
  const previousProjectBalance = revenue.balance;
  await tx.companyRevenueAccount.update({
    where: { id: revenue.id },
    data: { balance: { increment: input.amountRpc } },
  });
  const revenueAfter = await tx.companyRevenueAccount.findUniqueOrThrow({ where: { id: revenue.id } });
  const entry = await tx.companyCapitalFlowEntry.create({
    data: {
      companyId: input.companyId,
      actorUserId: input.actorUserId,
      type: input.type,
      source: input.source,
      amountRpc: input.amountRpc,
      previousWalletRpcBalance: input.previousWalletRpcBalance,
      newWalletRpcBalance: input.newWalletRpcBalance,
      previousProjectBalance,
      newProjectBalance: revenueAfter.balance,
      reason: input.reason.trim(),
      metadata: JSON.stringify({ ip: input.ip ?? null, userAgent: input.userAgent ?? null }),
    },
  });
  await tx.adminLog.create({
    data: {
      userId: input.actorUserId,
      action: 'PROJECT_INSTITUTIONAL_ENTRY',
      entity: 'CompanyCapitalFlowEntry',
      reason: input.reason.trim(),
      current: JSON.stringify({ entryId: entry.id, companyId: input.companyId, amountRpc: input.amountRpc.toString(), source: input.source }),
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
    },
  });
  return entry;
}
