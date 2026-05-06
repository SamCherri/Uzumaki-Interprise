import { prisma } from '../lib/prisma.js';
import { auditRpcSupplyConsistency } from './rpc-supply-policy-service.js';

export type EconomicAuditSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'WARNING';
export type EconomicAuditIssue = {
  code: string;
  severity: EconomicAuditSeverity;
  category: string;
  entity: string;
  entityId: string;
  companyId?: string;
  userId?: string;
  message: string;
  recommendedAction: string;
  metadata?: Record<string, unknown>;
};

const READ_ROLES = ['SUPER_ADMIN', 'COIN_CHIEF_ADMIN', 'AUDITOR', 'ADMIN'];
const SENSITIVE_ACTION_KEYWORDS = ['ISSUANCE', 'TREASURY', 'BROKER', 'ADJUST', 'WITHDRAW', 'APPROVE', 'SUSPEND', 'REACTIVATE', 'CLOSE', 'CAPITAL', 'BUYBACK', 'RESERVE', 'DISTRIBUT'];
const toNum = (v: unknown) => Number(v ?? 0);

export function assertEconomicAuditReadAccess(actorRoles: string[]) {
  if (!actorRoles.some((r) => READ_ROLES.includes(r))) {
    const err = new Error('Sem permissão para consultar auditoria econômica.');
    (err as Error & { statusCode?: number }).statusCode = 403;
    throw err;
  }
}

export async function runEconomicAudit(input: { actorRoles: string[]; filters?: { severity?: EconomicAuditSeverity; category?: string; companyId?: string; entity?: string; limit?: number; includeWarnings?: boolean } }) {
  assertEconomicAuditReadAccess(input.actorRoles);
  const filters = input.filters ?? {};
  const issues: EconomicAuditIssue[] = [];

  const [wallets, treasury, brokers, platforms, revenues, boostAccounts, holdings, orders, trades, companies, buybacks, reserve, reserveEntries, distributions, snapshots, payments, capitalFlowEntries, adminLogs] = await Promise.all([
    prisma.wallet.findMany(),
    prisma.treasuryAccount.findMany(),
    prisma.brokerAccount.findMany(),
    prisma.platformAccount.findMany(),
    prisma.companyRevenueAccount.findMany(),
    prisma.companyBoostAccount.findMany(),
    prisma.companyHolding.findMany(),
    prisma.marketOrder.findMany(),
    prisma.trade.findMany({ include: { buyOrder: true, sellOrder: true } }),
    prisma.company.findMany(),
    prisma.projectBuybackProgram.findMany({ include: { company: true } }),
    prisma.projectTokenReserve.findMany(),
    prisma.projectTokenReserveEntry.findMany(),
    prisma.projectHolderDistributionProgram.findMany(),
    prisma.projectHolderDistributionSnapshot.findMany(),
    prisma.projectHolderDistributionPayment.findMany(),
    prisma.companyCapitalFlowEntry.findMany(),
    prisma.adminLog.findMany({ orderBy: { createdAt: 'desc' }, take: 500 }),
  ]);

  for (const w of wallets) {
    if (toNum(w.rpcAvailableBalance) < 0) issues.push({ code: 'NEGATIVE_WALLET_RPC_AVAILABLE', severity: 'CRITICAL', category: 'NEGATIVE_BALANCE', entity: 'Wallet', entityId: w.id, userId: w.userId, message: 'rpcAvailableBalance negativo.', recommendedAction: 'Reconciliar saldo RPC da carteira.' });
    if (toNum(w.rpcLockedBalance) < 0) issues.push({ code: 'NEGATIVE_WALLET_RPC_LOCKED', severity: 'CRITICAL', category: 'NEGATIVE_BALANCE', entity: 'Wallet', entityId: w.id, userId: w.userId, message: 'rpcLockedBalance negativo.', recommendedAction: 'Reconciliar locks RPC da carteira.' });
    if (toNum(w.fiatAvailableBalance) < 0) issues.push({ code: 'NEGATIVE_WALLET_FIAT_AVAILABLE', severity: 'HIGH', category: 'NEGATIVE_BALANCE', entity: 'Wallet', entityId: w.id, userId: w.userId, message: 'fiatAvailableBalance negativo.', recommendedAction: 'Reconciliar saldo R$ fictício.' });
  }
  for (const t of treasury) if (toNum(t.balance) < 0) issues.push({ code: 'NEGATIVE_TREASURY_BALANCE', severity: 'CRITICAL', category: 'NEGATIVE_BALANCE', entity: 'TreasuryAccount', entityId: t.id, message: 'Saldo da tesouraria negativo.', recommendedAction: 'Auditar movimentações da tesouraria.' });
  for (const b of brokers) if (toNum(b.available) < 0) issues.push({ code: 'NEGATIVE_BROKER_AVAILABLE', severity: 'CRITICAL', category: 'NEGATIVE_BALANCE', entity: 'BrokerAccount', entityId: b.id, userId: b.userId, message: 'Saldo de corretor negativo.', recommendedAction: 'Auditar transferências para corretor.' });
  for (const p of platforms) if (toNum(p.balance) < 0) issues.push({ code: 'NEGATIVE_PLATFORM_BALANCE', severity: 'CRITICAL', category: 'NEGATIVE_BALANCE', entity: 'PlatformAccount', entityId: p.id, message: 'Saldo da plataforma negativo.', recommendedAction: 'Auditar distribuição de taxas e retiradas.' });
  for (const r of revenues) if (toNum(r.balance) < 0) issues.push({ code: 'NEGATIVE_COMPANY_REVENUE_BALANCE', severity: 'CRITICAL', category: 'NEGATIVE_BALANCE', entity: 'CompanyRevenueAccount', entityId: r.id, companyId: r.companyId, message: 'Saldo institucional negativo.', recommendedAction: 'Auditar fluxo de capital institucional.' });
  for (const b of boostAccounts) if (toNum(b.rpcBalance) < 0) issues.push({ code: 'NEGATIVE_BOOST_BALANCE', severity: 'HIGH', category: 'NEGATIVE_BALANCE', entity: 'CompanyBoostAccount', entityId: b.id, companyId: b.companyId, message: 'rpcBalance de boost negativo.', recommendedAction: 'Auditar histórico de boost legado.' });
  for (const h of holdings) if (h.shares < 0) issues.push({ code: 'NEGATIVE_HOLDING_SHARES', severity: 'CRITICAL', category: 'NEGATIVE_BALANCE', entity: 'CompanyHolding', entityId: h.id, companyId: h.companyId, userId: h.userId, message: 'Holding com shares negativos.', recommendedAction: 'Auditar trades e cancelamentos relacionados.' });

  for (const o of orders) {
    if (['OPEN', 'PARTIALLY_FILLED'].includes(o.status) && o.type === 'BUY' && toNum(o.lockedCash) <= 0) issues.push({ code: 'OPEN_BUY_WITHOUT_LOCKED_CASH', severity: 'CRITICAL', category: 'ORDER_LOCK', entity: 'MarketOrder', entityId: o.id, companyId: o.companyId, userId: o.userId, message: 'Ordem BUY aberta/parcial sem lockedCash válido.', recommendedAction: 'Auditar lock RPC e matching.' });
    if (['OPEN', 'PARTIALLY_FILLED'].includes(o.status) && o.type === 'SELL' && o.lockedShares <= 0) issues.push({ code: 'OPEN_SELL_WITHOUT_LOCKED_SHARES', severity: 'CRITICAL', category: 'ORDER_LOCK', entity: 'MarketOrder', entityId: o.id, companyId: o.companyId, userId: o.userId, message: 'Ordem SELL aberta/parcial sem lockedShares válido.', recommendedAction: 'Auditar lock de shares.' });
    if (o.status === 'CANCELED' && (toNum(o.lockedCash) > 0 || o.lockedShares > 0)) issues.push({ code: 'CANCELED_ORDER_WITH_LOCKED_BALANCE', severity: 'HIGH', category: 'ORDER_LOCK', entity: 'MarketOrder', entityId: o.id, companyId: o.companyId, userId: o.userId, message: 'Ordem cancelada ainda possui saldo travado.', recommendedAction: 'Auditar rotina de cancelamento.' });
  }

  for (const t of trades) {
    if (t.buyerId === t.sellerId) issues.push({ code: 'SELF_TRADE_BUYER_EQUALS_SELLER', severity: 'CRITICAL', category: 'SELF_TRADE', entity: 'Trade', entityId: t.id, companyId: t.companyId, userId: t.buyerId, message: 'Trade com buyerId igual sellerId.', recommendedAction: 'Investigar manipulação e bloquear origem.' });
    if (t.buyOrder?.userId && t.sellOrder?.userId && t.buyOrder.userId === t.sellOrder.userId) issues.push({ code: 'SELF_TRADE_ORDER_OWNERSHIP', severity: 'HIGH', category: 'SELF_TRADE', entity: 'Trade', entityId: t.id, companyId: t.companyId, userId: t.buyOrder.userId, message: 'Trade com ordens do mesmo usuário.', recommendedAction: 'Auditar matching e regras anti-self-trade.' });
  }

  const now = new Date();
  for (const b of buybacks) {
    if (b.status === 'ACTIVE' && b.expiresAt && b.expiresAt < now) issues.push({ code: 'BUYBACK_PROGRAM_EXPIRED_ACTIVE', severity: 'HIGH', category: 'BUYBACK', entity: 'ProjectBuybackProgram', entityId: b.id, companyId: b.companyId, message: 'Programa de recompra ativo e vencido.', recommendedAction: 'Revisar governança do programa.' });
    if (toNum(b.spentRpc) > toNum(b.budgetRpc)) issues.push({ code: 'BUYBACK_SPENT_EXCEEDS_BUDGET', severity: 'CRITICAL', category: 'BUYBACK', entity: 'ProjectBuybackProgram', entityId: b.id, companyId: b.companyId, message: 'spentRpc acima do budgetRpc.', recommendedAction: 'Auditar execuções e orçamento.' });
  }

  const reserveEntriesByCompany = new Map<string, number>();
  for (const e of reserveEntries) reserveEntriesByCompany.set(e.companyId, (reserveEntriesByCompany.get(e.companyId) ?? 0) + e.shares);
  for (const r of reserve) {
    if (r.locked === false) issues.push({ code: 'TOKEN_RESERVE_UNLOCKED', severity: 'HIGH', category: 'TOKEN_RESERVE', entity: 'ProjectTokenReserve', entityId: r.id, companyId: r.companyId, message: 'Reserva desbloqueada fora da política atual.', recommendedAction: 'Validar política HOLD_LOCKED.' });
    if (r.policy !== 'HOLD_LOCKED') issues.push({ code: 'TOKEN_RESERVE_POLICY_UNEXPECTED', severity: 'MEDIUM', category: 'TOKEN_RESERVE', entity: 'ProjectTokenReserve', entityId: r.id, companyId: r.companyId, message: 'Política da reserva diferente de HOLD_LOCKED.', recommendedAction: 'Revisar governança da reserva.' });
    if (r.shares !== (reserveEntriesByCompany.get(r.companyId) ?? 0)) issues.push({ code: 'TOKEN_RESERVE_SHARES_MISMATCH', severity: 'CRITICAL', category: 'TOKEN_RESERVE', entity: 'ProjectTokenReserve', entityId: r.id, companyId: r.companyId, message: 'Shares da reserva diverge da soma das entradas.', recommendedAction: 'Reconciliar entradas da reserva.' });
  }

  for (const p of distributions) {
    if (toNum(p.distributedRpc) > toNum(p.budgetRpc)) issues.push({ code: 'HOLDER_DISTRIBUTION_EXCEEDS_BUDGET', severity: 'CRITICAL', category: 'HOLDER_DISTRIBUTION', entity: 'ProjectHolderDistributionProgram', entityId: p.id, companyId: p.companyId, message: 'distributedRpc maior que budgetRpc.', recommendedAction: 'Auditar pagamentos e budget do programa.' });
  }
  for (const s of snapshots) if (toNum(s.calculatedAmountRpc) < 0) issues.push({ code: 'NEGATIVE_DISTRIBUTION_SNAPSHOT_AMOUNT', severity: 'HIGH', category: 'HOLDER_DISTRIBUTION', entity: 'ProjectHolderDistributionSnapshot', entityId: s.id, companyId: s.companyId, userId: s.userId, message: 'Snapshot com valor calculado negativo.', recommendedAction: 'Recalcular snapshot e critérios.' });

  for (const c of capitalFlowEntries) {
    if (toNum(c.amountRpc) <= 0) issues.push({ code: 'CAPITAL_FLOW_NON_POSITIVE_AMOUNT', severity: 'HIGH', category: 'TRACEABILITY', entity: 'CompanyCapitalFlowEntry', entityId: c.id, companyId: c.companyId, userId: c.actorUserId, message: 'Entry de capital com amountRpc <= 0.', recommendedAction: 'Corrigir fluxo institucional e exigir valores positivos.' });
    if (!c.reason?.trim()) issues.push({ code: 'CAPITAL_FLOW_MISSING_REASON', severity: 'HIGH', category: 'TRACEABILITY', entity: 'CompanyCapitalFlowEntry', entityId: c.id, companyId: c.companyId, userId: c.actorUserId, message: 'Entry de capital sem reason.', recommendedAction: 'Exigir motivo obrigatório em aporte institucional.' });
  }

  for (const log of adminLogs) {
    const sensitive = SENSITIVE_ACTION_KEYWORDS.some((k) => log.action.toUpperCase().includes(k));
    if (sensitive && !log.reason?.trim()) issues.push({ code: 'SENSITIVE_ADMIN_LOG_WITHOUT_REASON', severity: 'HIGH', category: 'ADMIN_GOVERNANCE', entity: 'AdminLog', entityId: log.id, userId: log.userId ?? undefined, message: 'AdminLog sensível sem justificativa.', recommendedAction: 'Obrigar reason nas ações sensíveis.' });
  }

  const rpcAudit = await auditRpcSupplyConsistency();
  for (const i of rpcAudit.issues) {
    issues.push({ code: i.code, severity: i.severity === 'CRITICAL' ? 'CRITICAL' : 'WARNING', category: 'RPC_POLICY', entity: i.entity, entityId: i.entityId, message: i.message, recommendedAction: 'Validar política de supply RPC e metadados obrigatórios.' });
  }

  let filtered = issues;
  if (!filters.includeWarnings) filtered = filtered.filter((i) => i.severity !== 'WARNING');
  if (filters.severity) filtered = filtered.filter((i) => i.severity === filters.severity);
  if (filters.category) filtered = filtered.filter((i) => i.category === filters.category);
  if (filters.companyId) filtered = filtered.filter((i) => i.companyId === filters.companyId);
  if (filters.entity) filtered = filtered.filter((i) => i.entity === filters.entity);
  if (filters.limit && filters.limit > 0) filtered = filtered.slice(0, filters.limit);

  const byCategory: Record<string, number> = {};
  for (const i of filtered) byCategory[i.category] = (byCategory[i.category] ?? 0) + 1;
  return { generatedAt: new Date().toISOString(), summary: { total: filtered.length, critical: filtered.filter((i) => i.severity === 'CRITICAL').length, high: filtered.filter((i) => i.severity === 'HIGH').length, medium: filtered.filter((i) => i.severity === 'MEDIUM').length, warning: filtered.filter((i) => i.severity === 'WARNING').length, byCategory }, issues: filtered };
}

export async function getEconomicAuditSummary(actorRoles: string[]) {
  const report = await runEconomicAudit({ actorRoles, filters: { includeWarnings: true, limit: 50 } });
  return { generatedAt: report.generatedAt, summary: report.summary, latestIssues: report.issues.slice(0, 10) };
}
