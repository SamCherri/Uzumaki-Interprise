import { FormEvent, useEffect, useState } from 'react';
import { api } from '../services/api';
import { AdminWithdrawalsPanel } from './AdminWithdrawalsPanel';
import { AdminUsersPanel } from './AdminUsersPanel';
import { AdminTokensPanel } from './AdminTokensPanel';
import { AdminAuditPanel } from './AdminAuditPanel';
import { AdminReportsPanel } from './AdminReportsPanel';

type Overview = { users: number; companies: number; logs: number; treasuryBalance: string | number };
type PlatformAccount = { balance: string | number; totalReceivedFees: string | number };
type CompanyRevenueAccount = {
  companyId: string;
  ticker: string;
  companyName: string;
  balance: string | number;
  totalReceivedFees: string | number;
  totalWithdrawn: string | number;
};
type ActiveTab = 'overview' | 'users' | 'brokers' | 'tokens' | 'withdrawals' | 'treasury' | 'revenues' | 'audit' | 'reports';

export function AdminDashboard() {
  const [tab, setTab] = useState<ActiveTab>('overview');
  const [data, setData] = useState<Overview | null>(null);
  const [platformAccount, setPlatformAccount] = useState<PlatformAccount | null>(null);
  const [companyRevenueAccounts, setCompanyRevenueAccounts] = useState<CompanyRevenueAccount[]>([]);
  const [error, setError] = useState('');

  const [issuanceAmount, setIssuanceAmount] = useState('');
  const [issuanceReason, setIssuanceReason] = useState('');
  const [brokerEmail, setBrokerEmail] = useState('');
  const [brokerAmount, setBrokerAmount] = useState('');
  const [brokerReason, setBrokerReason] = useState('');

  async function load() {
    try {
      const [overview, platform, companyRevenue] = await Promise.all([
        api<Overview>('/admin/overview'),
        api<PlatformAccount>('/admin/platform-account'),
        api<{ accounts: CompanyRevenueAccount[] }>('/admin/company-revenue-accounts'),
      ]);
      setData(overview);
      setPlatformAccount(platform);
      setCompanyRevenueAccounts(companyRevenue.accounts);
      setError('');
    } catch (err) {
      setError((err as Error).message);
    }
  }

  useEffect(() => { load(); }, []);

  async function submitIssuance(event: FormEvent) {
    event.preventDefault();
    await api('/admin/treasury/issuance', { method: 'POST', body: JSON.stringify({ amount: issuanceAmount, reason: issuanceReason }) });
    setIssuanceAmount('');
    setIssuanceReason('');
    await load();
  }

  async function submitBrokerTransfer(event: FormEvent) {
    event.preventDefault();
    await api('/admin/treasury/transfer-to-broker', { method: 'POST', body: JSON.stringify({ brokerEmail, amount: brokerAmount, reason: brokerReason }) });
    setBrokerEmail('');
    setBrokerAmount('');
    setBrokerReason('');
    await load();
  }

  return (
    <section className="card">
      <h2>🛠️ Painel Admin</h2>
      {error && <p className="status-message error">{error}</p>}

      <nav className="pill-nav nested-card">
        <button className={tab === 'overview' ? 'pill active' : 'pill'} onClick={() => setTab('overview')}>Visão geral</button>
        <button className={tab === 'users' ? 'pill active' : 'pill'} onClick={() => setTab('users')}>Usuários</button>
        <button className={tab === 'brokers' ? 'pill active' : 'pill'} onClick={() => setTab('brokers')}>Corretores</button>
        <button className={tab === 'tokens' ? 'pill active' : 'pill'} onClick={() => setTab('tokens')}>Tokens/Mercados</button>
        <button className={tab === 'withdrawals' ? 'pill active' : 'pill'} onClick={() => setTab('withdrawals')}>Saques</button>
        <button className={tab === 'treasury' ? 'pill active' : 'pill'} onClick={() => setTab('treasury')}>Tesouraria</button>
        <button className={tab === 'revenues' ? 'pill active' : 'pill'} onClick={() => setTab('revenues')}>Receitas</button>
        <button className={tab === 'audit' ? 'pill active' : 'pill'} onClick={() => setTab('audit')}>Auditoria</button>
        <button className={tab === 'reports' ? 'pill active' : 'pill'} onClick={() => setTab('reports')}>Relatórios</button>
      </nav>

      {tab === 'overview' && data && (
        <div className="summary-grid nested-card">
          <div className="summary-item"><span className="summary-label">Usuários</span><strong className="summary-value">{data.users}</strong></div>
          <div className="summary-item"><span className="summary-label">Mercados listados</span><strong className="summary-value">{data.companies}</strong></div>
          <div className="summary-item"><span className="summary-label">Logs</span><strong className="summary-value">{data.logs}</strong></div>
          <div className="summary-item"><span className="summary-label">Tesouraria RPC</span><strong className="summary-value">{data.treasuryBalance}</strong></div>
        </div>
      )}

      {(tab === 'users' || tab === 'brokers') && <AdminUsersPanel />}
      {tab === 'tokens' && <AdminTokensPanel />}
      {tab === 'withdrawals' && <AdminWithdrawalsPanel />}

      {tab === 'treasury' && (
        <>
          <h3 className="nested-card">Emitir RPC</h3>
          <form onSubmit={submitIssuance} className="form-grid">
            <input value={issuanceAmount} onChange={(e) => setIssuanceAmount(e.target.value)} placeholder="Quantidade" required />
            <input value={issuanceReason} onChange={(e) => setIssuanceReason(e.target.value)} placeholder="Motivo" required />
            <button className="button-primary" type="submit">Emitir RPC</button>
          </form>

          <h3 className="nested-card">Enviar RPC para corretor</h3>
          <form onSubmit={submitBrokerTransfer} className="form-grid">
            <input value={brokerEmail} onChange={(e) => setBrokerEmail(e.target.value)} placeholder="E-mail do corretor" type="email" required />
            <input value={brokerAmount} onChange={(e) => setBrokerAmount(e.target.value)} placeholder="Quantidade RPC" required />
            <input value={brokerReason} onChange={(e) => setBrokerReason(e.target.value)} placeholder="Observação" required />
            <button className="button-primary" type="submit">Enviar RPC ao corretor</button>
          </form>
        </>
      )}

      {tab === 'revenues' && (
        <>
          <h3 className="nested-card">Receita da Plataforma</h3>
          {platformAccount && (
            <div className="summary-grid">
              <div className="summary-item"><span className="summary-label">Saldo</span><strong className="summary-value">{platformAccount.balance}</strong></div>
              <div className="summary-item"><span className="summary-label">Taxas recebidas</span><strong className="summary-value">{platformAccount.totalReceivedFees}</strong></div>
            </div>
          )}

          <h3 className="nested-card">Receita dos projetos/tokens</h3>
          <div className="mobile-card-list">
            {companyRevenueAccounts.map((account) => (
              <article key={account.companyId} className="summary-item compact-card">
                <strong>{account.companyName} ({account.ticker})</strong>
                <p>Saldo: {account.balance}</p>
                <p>Total de taxas: {account.totalReceivedFees}</p>
                <p>Total retirado: {account.totalWithdrawn}</p>
              </article>
            ))}
          </div>
        </>
      )}

      {tab === 'audit' && <AdminAuditPanel />}
      {tab === 'reports' && <AdminReportsPanel />}
    </section>
  );
}
