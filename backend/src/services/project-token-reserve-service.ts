import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../lib/prisma.js';
import { HttpError } from '../lib/http-error.js';

const AUDIT_ROLES = ['SUPER_ADMIN', 'COIN_CHIEF_ADMIN', 'AUDITOR'];

function hasAuditRole(roles: string[] = []) {
  return roles.some((role) => AUDIT_ROLES.includes(role.toUpperCase()));
}

function toNum(value: unknown) { return Number(value ?? 0); }

export async function auditProjectTokenReserve(companyId: string) {
  const [company, reserve, entries, executions, founderHolding] = await Promise.all([
    prisma.company.findUnique({ where: { id: companyId } }),
    prisma.projectTokenReserve.findUnique({ where: { companyId } }),
    prisma.projectTokenReserveEntry.findMany({ where: { companyId }, include: { program: true, execution: true } }),
    prisma.projectBuybackExecution.findMany({ where: { companyId } }),
    prisma.company.findUnique({ where: { id: companyId }, select: { founderUserId: true, holdings: true } }),
  ]);

  if (!company) throw new HttpError(404, 'Projeto não encontrado.');
  const issues: string[] = [];
  const reserveShares = reserve?.shares ?? 0;
  const reserveCost = toNum(reserve?.totalCostRpc);
  if (reserveShares < 0) issues.push('RESERVE_NEGATIVE_SHARES');
  if (reserveCost < 0) issues.push('RESERVE_NEGATIVE_COST');
  if (!reserve?.policy) issues.push('RESERVE_POLICY_MISSING');

  let entryShares = 0;
  let entryCost = 0;
  for (const entry of entries) {
    entryShares += entry.shares;
    entryCost += toNum(entry.totalCostRpc);
    if (entry.shares <= 0) issues.push(`ENTRY_NON_POSITIVE_SHARES:${entry.id}`);
    if (toNum(entry.totalCostRpc) <= 0) issues.push(`ENTRY_NON_POSITIVE_COST:${entry.id}`);
    if (!entry.reason?.trim()) issues.push(`ENTRY_REASON_MISSING:${entry.id}`);
    if (!entry.programId) issues.push(`ENTRY_PROGRAM_MISSING:${entry.id}`);
    if (!entry.executionId) issues.push(`ENTRY_EXECUTION_MISSING:${entry.id}`);
    if (entry.type === 'BUYBACK_IN' && !entry.execution) issues.push(`ENTRY_BUYBACK_WITHOUT_EXECUTION:${entry.id}`);
  }

  for (const execution of executions) {
    const linked = entries.some((entry) => entry.executionId === execution.id);
    if (!linked) issues.push(`EXECUTION_WITHOUT_RESERVE_ENTRY:${execution.id}`);
  }

  if (entryShares !== reserveShares) issues.push('RESERVE_SHARES_SUM_MISMATCH');
  if (Math.abs(entryCost - reserveCost) > 0.01) issues.push('RESERVE_COST_SUM_MISMATCH');
  if (reserveShares > 0 && entries.length === 0) issues.push('RESERVE_WITH_SHARES_WITHOUT_ENTRIES');
  if (reserveCost > 0 && reserveShares === 0) issues.push('RESERVE_COST_WITHOUT_SHARES');
  if (founderHolding?.holdings?.some((h) => h.userId === founderHolding.founderUserId && h.shares > 0) && reserveShares > 0) {
    issues.push('FOUNDER_HAS_HOLDING_WHILE_RESERVE_EXISTS');
  }

  return {
    companyId,
    issues,
    totals: {
      reserveShares,
      reserveCostRpc: reserveCost,
      entryShares,
      entryCostRpc: Number(entryCost.toFixed(2)),
    },
  };
}

export async function getProjectTokenReserveSummary(companyId: string, actorUserId: string, actorRoles: string[] = []) {
  const company = await prisma.company.findUnique({ where: { id: companyId }, include: { tokenReserve: true } });
  if (!company) throw new HttpError(404, 'Projeto não encontrado.');
  const canAudit = hasAuditRole(actorRoles);
  const isOwner = company.founderUserId === actorUserId;
  if (!isOwner && !canAudit) throw new HttpError(403, 'Sem permissão.');

  const entries = await prisma.projectTokenReserveEntry.findMany({ where: { companyId }, include: { program: true, execution: true }, orderBy: { createdAt: 'desc' }, take: 30 });
  const allEntries = await prisma.projectTokenReserveEntry.findMany({ where: { companyId } });
  const totalsByType = allEntries.reduce<Record<string, { shares: number; totalCostRpc: number }>>((acc, entry) => {
    acc[entry.type] ??= { shares: 0, totalCostRpc: 0 };
    acc[entry.type].shares += entry.shares;
    acc[entry.type].totalCostRpc += Number(entry.totalCostRpc);
    return acc;
  }, {});

  const reserveShares = company.tokenReserve?.shares ?? 0;
  const totalCostRpc = Number(company.tokenReserve?.totalCostRpc ?? 0);
  const averageCostRpc = reserveShares > 0 ? Number((totalCostRpc / reserveShares).toFixed(8)) : 0;
  const audit = await auditProjectTokenReserve(companyId);

  return {
    companyId,
    ticker: company.ticker,
    companyName: company.name,
    reserve: {
      reserveShares,
      totalCostRpc,
      averageCostRpc,
      policy: company.tokenReserve?.policy ?? 'HOLD_LOCKED',
      locked: company.tokenReserve?.locked ?? true,
      notes: company.tokenReserve?.notes ?? null,
      lastAuditAt: company.tokenReserve?.lastAuditAt ?? null,
    },
    entries,
    totals: {
      totalEntries: allEntries.length,
      totalsByType,
      linkedBuybackPrograms: new Set(allEntries.map((entry) => entry.programId)).size,
      linkedExecutions: new Set(allEntries.map((entry) => entry.executionId)).size,
    },
    inconsistencies: audit.issues,
  };
}

export async function listMyProjectTokenReserves(actorUserId: string) {
  const companies = await prisma.company.findMany({ where: { founderUserId: actorUserId }, include: { tokenReserve: true } });
  return companies.map((company) => ({
    companyId: company.id,
    ticker: company.ticker,
    companyName: company.name,
    reserveShares: company.tokenReserve?.shares ?? 0,
    totalCostRpc: Number(company.tokenReserve?.totalCostRpc ?? 0),
    policy: company.tokenReserve?.policy ?? 'HOLD_LOCKED',
    locked: company.tokenReserve?.locked ?? true,
  }));
}

export async function listAdminProjectTokenReserves(actorUserId: string, actorRoles: string[]) {
  if (!hasAuditRole(actorRoles)) throw new HttpError(403, 'Sem permissão.');
  const companies = await prisma.company.findMany({ include: { tokenReserve: true } });
  const results = [];
  for (const company of companies) {
    const audit = await auditProjectTokenReserve(company.id);
    results.push({
      companyId: company.id,
      ticker: company.ticker,
      companyName: company.name,
      reserveShares: company.tokenReserve?.shares ?? 0,
      totalCostRpc: Number(company.tokenReserve?.totalCostRpc ?? 0),
      policy: company.tokenReserve?.policy ?? 'HOLD_LOCKED',
      locked: company.tokenReserve?.locked ?? true,
      inconsistencies: audit.issues,
    });
  }
  return { actorUserId, reserves: results };
}
