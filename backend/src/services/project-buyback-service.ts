import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../lib/prisma.js';
import { HttpError } from '../lib/http-error.js';

const ADMIN_ROLES = ['ADMIN', 'SUPER_ADMIN', 'COIN_CHIEF_ADMIN'];
const ZERO = new Decimal(0);

function hasAdminRole(roles: string[]) { return roles.some((r) => ADMIN_ROLES.includes(r.toUpperCase())); }

export async function createBuybackProgram(input: { companyId: string; actorUserId: string; actorRoles?: string[]; budgetRpc: number; maxPricePerShare: number; targetShares: number; reason: string; expiresAt?: string; ip?: string; userAgent?: string | null }) {
  const reason = input.reason.trim();
  if (reason.length < 10) throw new HttpError(400, 'Motivo deve ter ao menos 10 caracteres.');
  const budgetRpc = new Decimal(input.budgetRpc).toDecimalPlaces(2);
  const maxPricePerShare = new Decimal(input.maxPricePerShare).toDecimalPlaces(8);
  if (budgetRpc.lte(0) || maxPricePerShare.lte(0) || input.targetShares <= 0) throw new HttpError(400, 'Parâmetros inválidos.');

  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.$queryRaw`SELECT id FROM "Company" WHERE id = ${input.companyId} FOR UPDATE`;
    const company = await tx.company.findUnique({ where: { id: input.companyId }, include: { revenueAccount: true } });
    if (!company) throw new HttpError(404, 'Projeto não encontrado.');
    const isOwner = company.founderUserId === input.actorUserId;
    if (!isOwner && !hasAdminRole(input.actorRoles ?? [])) throw new HttpError(403, 'Sem permissão.');
    if (company.status !== 'ACTIVE') throw new HttpError(400, 'Projeto precisa estar ACTIVE.');
    const revenue = await tx.companyRevenueAccount.findUnique({ where: { companyId: company.id } });
    if (!revenue) throw new HttpError(400, 'Conta institucional não encontrada.');
    const debited = await tx.companyRevenueAccount.updateMany({ where: { id: revenue.id, balance: { gte: budgetRpc } }, data: { balance: { decrement: budgetRpc } } });
    if (debited.count !== 1) throw new HttpError(400, 'Saldo institucional insuficiente.');

    const program = await tx.projectBuybackProgram.create({ data: { companyId: company.id, createdByUserId: input.actorUserId, budgetRpc, remainingRpc: budgetRpc, maxPricePerShare, targetShares: input.targetShares, reason, expiresAt: input.expiresAt ? new Date(input.expiresAt) : null } });
    await tx.adminLog.create({ data: { userId: input.actorUserId, action: 'PROJECT_BUYBACK_CREATE', entity: 'ProjectBuybackProgram', reason, current: JSON.stringify({ programId: program.id, companyId: company.id, budgetRpc: String(budgetRpc) }), ip: input.ip ?? null, userAgent: input.userAgent ?? null } });
    return program;
  });
}

export async function executeBuybackProgram(input: { programId: string; actorUserId: string; actorRoles?: string[]; maxExecutions?: number; ip?: string; userAgent?: string | null }) {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const program = await tx.projectBuybackProgram.findUnique({ where: { id: input.programId }, include: { company: true } });
    if (!program) throw new HttpError(404, 'Programa não encontrado.');
    const isOwner = program.company.founderUserId === input.actorUserId;
    if (!isOwner && !hasAdminRole(input.actorRoles ?? [])) throw new HttpError(403, 'Sem permissão.');
    if (program.status !== 'ACTIVE') throw new HttpError(400, 'Programa não está ativo.');
    if (program.expiresAt && program.expiresAt.getTime() < Date.now()) throw new HttpError(400, 'Programa expirado.');

    const sellOrders = await tx.marketOrder.findMany({ where: { companyId: program.companyId, type: 'SELL', status: { in: ['OPEN', 'PARTIALLY_FILLED'] }, remainingQuantity: { gt: 0 }, limitPrice: { lte: program.maxPricePerShare }, userId: { not: program.company.founderUserId } }, orderBy: [{ limitPrice: 'asc' }, { createdAt: 'asc' }], take: input.maxExecutions ?? 100 });

    let remainingRpc = program.remainingRpc;
    let purchasedShares = program.purchasedShares;
    let spentRpc = program.spentRpc;
    let executed = 0;

    for (const order of sellOrders) {
      if (remainingRpc.lte(0) || purchasedShares >= program.targetShares) break;
      const maxByBudget = Number(remainingRpc.div(order.limitPrice!).floor());
      const maxByTarget = program.targetShares - purchasedShares;
      const qty = Math.min(order.remainingQuantity, maxByBudget, maxByTarget);
      if (qty <= 0) continue;
      const gross = order.limitPrice!.mul(qty).toDecimalPlaces(2);

      const sellerWallet = await tx.wallet.findUniqueOrThrow({ where: { userId: order.userId } });
      await tx.wallet.update({ where: { id: sellerWallet.id }, data: { rpcAvailableBalance: { increment: gross } } });

      const trade = await tx.trade.create({ data: { companyId: program.companyId, buyerId: input.actorUserId, sellerId: order.userId, buyOrderId: null, sellOrderId: order.id, quantity: qty, unitPrice: order.limitPrice!, grossAmount: gross, buyFeeAmount: ZERO, sellFeeAmount: ZERO } });
      await tx.company.update({ where: { id: program.companyId }, data: { currentPrice: order.limitPrice! } });
      await tx.marketOrder.update({ where: { id: order.id }, data: { remainingQuantity: { decrement: qty }, lockedShares: { decrement: qty }, status: order.remainingQuantity === qty ? 'FILLED' : 'PARTIALLY_FILLED', executedAt: order.remainingQuantity === qty ? new Date() : null } });

      const reserve = await tx.projectTokenReserve.upsert({ where: { companyId: program.companyId }, create: { companyId: program.companyId, shares: qty, totalCostRpc: gross }, update: { shares: { increment: qty }, totalCostRpc: { increment: gross } } });
      const exec = await tx.projectBuybackExecution.create({ data: { programId: program.id, companyId: program.companyId, sellerUserId: order.userId, tradeId: trade.id, quantity: qty, unitPrice: order.limitPrice!, grossAmountRpc: gross, totalAmountRpc: gross } });
      await tx.projectTokenReserveEntry.create({ data: { companyId: program.companyId, programId: program.id, executionId: exec.id, type: 'BUYBACK_IN', shares: qty, unitPrice: order.limitPrice!, totalCostRpc: gross, reason: `Recompra programa ${program.id}` } });

      remainingRpc = remainingRpc.sub(gross).toDecimalPlaces(2);
      spentRpc = spentRpc.add(gross).toDecimalPlaces(2);
      purchasedShares += qty;
      executed++;
    }

    const newStatus = (remainingRpc.lte(0) || purchasedShares >= program.targetShares) ? 'COMPLETED' : 'ACTIVE';
    const updatedProgram = await tx.projectBuybackProgram.update({ where: { id: program.id }, data: { remainingRpc, spentRpc, purchasedShares, status: newStatus, completedAt: newStatus === 'COMPLETED' ? new Date() : null } });
    await tx.adminLog.create({ data: { userId: input.actorUserId, action: 'PROJECT_BUYBACK_EXECUTE', entity: 'ProjectBuybackProgram', reason: `Execuções: ${executed}`, current: JSON.stringify({ programId: program.id }), ip: input.ip ?? null, userAgent: input.userAgent ?? null } });
    return { program: updatedProgram, executions: executed };
  });
}

export async function cancelBuybackProgram(input: { programId: string; actorUserId: string; actorRoles?: string[]; ip?: string; userAgent?: string | null }) {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const program = await tx.projectBuybackProgram.findUnique({ where: { id: input.programId }, include: { company: true } });
    if (!program) throw new HttpError(404, 'Programa não encontrado.');
    const isOwner = program.company.founderUserId === input.actorUserId;
    if (!isOwner && !hasAdminRole(input.actorRoles ?? [])) throw new HttpError(403, 'Sem permissão.');
    if (program.status !== 'ACTIVE') throw new HttpError(400, 'Apenas ACTIVE pode cancelar.');
    if (program.remainingRpc.gt(0)) await tx.companyRevenueAccount.update({ where: { companyId: program.companyId }, data: { balance: { increment: program.remainingRpc } } });
    const updated = await tx.projectBuybackProgram.update({ where: { id: program.id }, data: { status: 'CANCELED', canceledAt: new Date(), remainingRpc: ZERO } });
    await tx.adminLog.create({ data: { userId: input.actorUserId, action: 'PROJECT_BUYBACK_CANCEL', entity: 'ProjectBuybackProgram', reason: 'Cancelado pelo ator autorizado', current: JSON.stringify({ programId: program.id }), ip: input.ip ?? null, userAgent: input.userAgent ?? null } });
    return updated;
  });
}
