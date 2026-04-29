import { FormEvent, useEffect, useState } from 'react';
import { api } from '../services/api';
import {
  translateCompanyStatus,
  translateOrderMode,
  translateOrderStatus,
  translateOrderType,
  translateRole,
  translateTransferType,
  translateWithdrawalStatus,
} from '../utils/labels';

type ReportDateFilter = { from: string; to: string };

export function AdminReportsPanel() {
  const [overview, setOverview] = useState<any>(null);
  const [revenues, setRevenues] = useState<any[]>([]);

  const [userFilters, setUserFilters] = useState({ userId: '', from: '', to: '' });
  const [brokerFilters, setBrokerFilters] = useState({ userId: '', from: '', to: '' });

  const [userReport, setUserReport] = useState<any>(null);
  const [brokerReport, setBrokerReport] = useState<any>(null);

  const [userLoading, setUserLoading] = useState(false);
  const [brokerLoading, setBrokerLoading] = useState(false);
  const [userError, setUserError] = useState('');
  const [brokerError, setBrokerError] = useState('');

  useEffect(() => { void load(); }, []);

  async function load() {
    const [ov, rev] = await Promise.all([
      api('/admin/reports/overview'),
      api<{ items: any[] }>('/admin/reports/company-revenues'),
    ]);
    setOverview(ov);
    setRevenues(rev.items ?? []);
  }

  function buildQuery({ from, to }: ReportDateFilter) {
    const query = new URLSearchParams();
    if (from) query.set('from', from);
    if (to) query.set('to', to);
    const queryString = query.toString();
    return queryString ? `?${queryString}` : '';
  }

  async function handleUserReportSubmit(event: FormEvent) {
    event.preventDefault();
    if (!userFilters.userId.trim()) {
      setUserError('Informe o ID do usuário.');
      return;
    }

    setUserError('');
    setUserLoading(true);
    try {
      const query = buildQuery({ from: userFilters.from, to: userFilters.to });
      const response = await api(`/admin/reports/users/${encodeURIComponent(userFilters.userId.trim())}${query}`);
      setUserReport(response);
    } catch (error) {
      setUserError(error instanceof Error ? error.message : 'Erro ao carregar relatório do usuário.');
    } finally {
      setUserLoading(false);
    }
  }

  async function handleBrokerReportSubmit(event: FormEvent) {
    event.preventDefault();
    if (!brokerFilters.userId.trim()) {
      setBrokerError('Informe o ID do corretor.');
      return;
    }

    setBrokerError('');
    setBrokerLoading(true);
    try {
      const query = buildQuery({ from: brokerFilters.from, to: brokerFilters.to });
      const response = await api(`/admin/reports/brokers/${encodeURIComponent(brokerFilters.userId.trim())}${query}`);
      setBrokerReport(response);
    } catch (error) {
      setBrokerError(error instanceof Error ? error.message : 'Erro ao carregar relatório do corretor.');
    } finally {
      setBrokerLoading(false);
    }
  }

  return <div className="nested-card">
    <h3>Relatórios</h3>
    {overview && <div className="summary-grid">{Object.entries(overview).map(([k, v]) => <div key={k} className="summary-item"><span className="summary-label">{k}</span><strong className="summary-value">{String(v)}</strong></div>)}</div>}

    <h4>Receitas por projeto</h4>
    <div className="mobile-card-list">{revenues.map((item) => <article className="summary-item compact-card" key={item.companyId}><strong>{item.ticker} - {item.token}</strong><p>Dono: {item.owner?.name ?? '-'}</p><p>Saldo: {String(item.balance)}</p><p>Taxas: {String(item.totalReceivedFees)}</p><p>Status: {translateCompanyStatus(item.status)}</p></article>)}</div>

    <h4>Relatório por usuário</h4>
    <form className="filters-row" onSubmit={handleUserReportSubmit}>
      <input placeholder="ID do usuário" value={userFilters.userId} onChange={(event) => setUserFilters((prev) => ({ ...prev, userId: event.target.value }))} />
      <input type="date" value={userFilters.from} onChange={(event) => setUserFilters((prev) => ({ ...prev, from: event.target.value }))} />
      <input type="date" value={userFilters.to} onChange={(event) => setUserFilters((prev) => ({ ...prev, to: event.target.value }))} />
      <button type="submit" disabled={userLoading}>{userLoading ? 'Buscando...' : 'Buscar usuário'}</button>
    </form>
    {userError && <p>{userError}</p>}
    {userReport && <>
      <div className="summary-grid">
        <div className="summary-item"><span className="summary-label">Nome</span><strong className="summary-value">{userReport.user?.name ?? '-'}</strong></div>
        <div className="summary-item"><span className="summary-label">E-mail</span><strong className="summary-value">{userReport.user?.email ?? '-'}</strong></div>
        <div className="summary-item"><span className="summary-label">Cargos</span><strong className="summary-value">{(userReport.user?.roles ?? []).map((role: string) => translateRole(role)).join(', ') || '-'}</strong></div>
        <div className="summary-item"><span className="summary-label">Status</span><strong className="summary-value">{userReport.user?.isBlocked ? 'Bloqueado' : 'Ativo'}</strong></div>
        <div className="summary-item"><span className="summary-label">Saldo disponível</span><strong className="summary-value">{String(userReport.wallet?.availableBalance ?? 0)}</strong></div>
        <div className="summary-item"><span className="summary-label">Saldo bloqueado</span><strong className="summary-value">{String(userReport.wallet?.lockedBalance ?? 0)}</strong></div>
        <div className="summary-item"><span className="summary-label">Pendente saque</span><strong className="summary-value">{String(userReport.wallet?.pendingWithdrawalBalance ?? 0)}</strong></div>
        <div className="summary-item"><span className="summary-label">Total recebido</span><strong className="summary-value">{String(userReport.summary?.transferredIn ?? 0)}</strong></div>
        <div className="summary-item"><span className="summary-label">Total enviado</span><strong className="summary-value">{String(userReport.summary?.transferredOut ?? 0)}</strong></div>
        <div className="summary-item"><span className="summary-label">Saques pendentes</span><strong className="summary-value">{String(userReport.summary?.withdrawalsPending ?? 0)}</strong></div>
        <div className="summary-item"><span className="summary-label">Saques concluídos</span><strong className="summary-value">{String(userReport.summary?.withdrawalsCompleted ?? 0)}</strong></div>
        <div className="summary-item"><span className="summary-label">Ordens abertas</span><strong className="summary-value">{String(userReport.summary?.openOrders ?? 0)}</strong></div>
        <div className="summary-item"><span className="summary-label">Ordens executadas</span><strong className="summary-value">{String(userReport.summary?.filledOrders ?? 0)}</strong></div>
        <div className="summary-item"><span className="summary-label">Holdings</span><strong className="summary-value">{String(userReport.summary?.holdingsCount ?? 0)}</strong></div>
      </div>

      <h5>Últimas transações</h5>
      <div className="mobile-card-list">{(userReport.recentTransactions ?? []).map((item: any) => <article className="summary-item compact-card" key={item.id}><p><strong>{item.type}</strong></p><p>Valor: {String(item.amount)}</p><p>{new Date(item.createdAt).toLocaleString('pt-BR')}</p></article>)}</div>

      <h5>Últimas transferências</h5>
      <div className="mobile-card-list">{(userReport.recentTransfers ?? []).map((item: any) => <article className="summary-item compact-card" key={item.id}><p><strong>{translateTransferType(item.type)}</strong></p><p>Valor: {String(item.amount)}</p><p>De: {item.sender?.name ?? '-'}</p><p>Para: {item.receiver?.name ?? '-'}</p></article>)}</div>

      <h5>Últimos saques</h5>
      <div className="mobile-card-list">{(userReport.recentWithdrawals ?? []).map((item: any) => <article className="summary-item compact-card" key={item.id}><p><strong>{translateWithdrawalStatus(item.status)}</strong></p><p>Valor: {String(item.amount)}</p><p>Código: {item.code}</p></article>)}</div>

      <h5>Últimas ordens</h5>
      <div className="mobile-card-list">{(userReport.recentOrders ?? []).map((item: any) => <article className="summary-item compact-card" key={item.id}><p><strong>{translateOrderType(item.type)} · {translateOrderMode(item.mode)}</strong></p><p>Status: {translateOrderStatus(item.status)}</p><p>Empresa: {item.company?.ticker} - {item.company?.name}</p></article>)}</div>

      <h5>Holdings</h5>
      <div className="mobile-card-list">{(userReport.holdings ?? []).map((item: any) => <article className="summary-item compact-card" key={item.id}><p><strong>{item.company?.ticker} - {item.company?.name}</strong></p><p>Ações: {String(item.shares)}</p><p>Preço médio: {String(item.averageBuyPrice)}</p><p>Status: {translateCompanyStatus(item.company?.status)}</p></article>)}</div>
    </>}

    <h4>Relatório por corretor</h4>
    <form className="filters-row" onSubmit={handleBrokerReportSubmit}>
      <input placeholder="ID do corretor" value={brokerFilters.userId} onChange={(event) => setBrokerFilters((prev) => ({ ...prev, userId: event.target.value }))} />
      <input type="date" value={brokerFilters.from} onChange={(event) => setBrokerFilters((prev) => ({ ...prev, from: event.target.value }))} />
      <input type="date" value={brokerFilters.to} onChange={(event) => setBrokerFilters((prev) => ({ ...prev, to: event.target.value }))} />
      <button type="submit" disabled={brokerLoading}>{brokerLoading ? 'Buscando...' : 'Buscar corretor'}</button>
    </form>
    {brokerError && <p>{brokerError}</p>}
    {brokerReport && <>
      <div className="summary-grid">
        <div className="summary-item"><span className="summary-label">Nome</span><strong className="summary-value">{brokerReport.broker?.name ?? '-'}</strong></div>
        <div className="summary-item"><span className="summary-label">E-mail</span><strong className="summary-value">{brokerReport.broker?.email ?? '-'}</strong></div>
        <div className="summary-item"><span className="summary-label">Saldo corretor</span><strong className="summary-value">{String(brokerReport.brokerAccount?.availableBalance ?? 0)}</strong></div>
        <div className="summary-item"><span className="summary-label">Total recebido</span><strong className="summary-value">{String(brokerReport.brokerAccount?.receivedTotal ?? 0)}</strong></div>
        <div className="summary-item"><span className="summary-label">Total transferido</span><strong className="summary-value">{String(brokerReport.brokerAccount?.transferredTotal ?? 0)}</strong></div>
        <div className="summary-item"><span className="summary-label">Recebido da tesouraria</span><strong className="summary-value">{String(brokerReport.summary?.receivedFromTreasury ?? 0)}</strong></div>
        <div className="summary-item"><span className="summary-label">Enviado a usuários</span><strong className="summary-value">{String(brokerReport.summary?.sentToUsers ?? 0)}</strong></div>
        <div className="summary-item"><span className="summary-label">Quantidade de envios</span><strong className="summary-value">{String(brokerReport.summary?.transfersToUsersCount ?? 0)}</strong></div>
        <div className="summary-item"><span className="summary-label">Usuários atendidos</span><strong className="summary-value">{String(brokerReport.summary?.usersServedCount ?? 0)}</strong></div>
        <div className="summary-item"><span className="summary-label">Última transferência</span><strong className="summary-value">{brokerReport.summary?.lastTransferAt ? new Date(brokerReport.summary.lastTransferAt).toLocaleString('pt-BR') : '-'}</strong></div>
      </div>

      <h5>Últimas transferências</h5>
      <div className="mobile-card-list">{(brokerReport.recentTransfers ?? []).map((item: any) => <article className="summary-item compact-card" key={item.id}><p><strong>{translateTransferType(item.type)}</strong></p><p>Valor: {String(item.amount)}</p><p>De: {item.sender?.name ?? '-'}</p><p>Para: {item.receiver?.name ?? '-'}</p><p>{new Date(item.createdAt).toLocaleString('pt-BR')}</p></article>)}</div>
    </>}
  </div>;
}
