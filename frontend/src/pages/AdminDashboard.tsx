import { FormEvent, useEffect, useState } from 'react';
import { api } from '../services/api';
import { AdminWithdrawalsPanel } from './AdminWithdrawalsPanel';
import { AdminUsersPanel } from './AdminUsersPanel';
import { AdminTokensPanel } from './AdminTokensPanel';
import { AdminAuditPanel } from './AdminAuditPanel';
import { AdminReportsPanel } from './AdminReportsPanel';
import { SideDrawer, SideDrawerItem } from '../components/SideDrawer';

type Overview = { users: number; companies: number; logs: number; treasuryBalance: string | number };
type PlatformAccount = { balance: string | number; totalReceivedFees: string | number; totalWithdrawn: string | number; updatedAt: string | null };
type CompanyRevenueAccount = {
  companyId: string;
  ticker: string;
  companyName: string;
  balance: string | number;
  totalReceivedFees: string | number;
  totalWithdrawn: string | number;
};
type ActiveTab = 'overview' | 'users' | 'brokers' | 'tokens' | 'withdrawals' | 'treasury' | 'revenues' | 'audit' | 'reports';

type AdminDashboardProps = {
  currentUserRoles: string[];
  onPermissionsUpdated: () => Promise<void>;
};

export function AdminDashboard({ currentUserRoles, onPermissionsUpdated }: AdminDashboardProps) {
  const [tab, setTab] = useState<ActiveTab>('overview');
  const [data, setData] = useState<Overview | null>(null);
  const [platformAccount, setPlatformAccount] = useState<PlatformAccount | null>(null);
  const [companyRevenueAccounts, setCompanyRevenueAccounts] = useState<CompanyRevenueAccount[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmittingIssuance, setIsSubmittingIssuance] = useState(false);
  const [isSubmittingBrokerTransfer, setIsSubmittingBrokerTransfer] = useState(false);
  const [isSubmittingUserDeposit, setIsSubmittingUserDeposit] = useState(false);

  const [issuanceAmount, setIssuanceAmount] = useState('');
  const [issuanceReason, setIssuanceReason] = useState('');
  const [brokerEmail, setBrokerEmail] = useState('');
  const [brokerAmount, setBrokerAmount] = useState('');
  const [brokerReason, setBrokerReason] = useState('');
  const [userDepositEmail, setUserDepositEmail] = useState('');
  const [userDepositAmount, setUserDepositAmount] = useState('');
  const [userDepositReason, setUserDepositReason] = useState('');
  const [platformWithdrawEmail, setPlatformWithdrawEmail] = useState('');
  const [platformWithdrawAmount, setPlatformWithdrawAmount] = useState('');
  const [platformWithdrawReason, setPlatformWithdrawReason] = useState('');
  const [isSubmittingPlatformWithdraw, setIsSubmittingPlatformWithdraw] = useState(false);
  const [isAdminDrawerOpen, setIsAdminDrawerOpen] = useState(false);

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
      setMessage('');
    } catch (err) {
      setError((err as Error).message);
    }
  }

  useEffect(() => { load(); }, []);

  const roles = currentUserRoles.map((role) => role.toUpperCase());
  const canWithdrawPlatformProfit = roles.includes('SUPER_ADMIN') || roles.includes('COIN_CHIEF_ADMIN');
  const canIssueRpc = roles.includes('SUPER_ADMIN') || roles.includes('COIN_CHIEF_ADMIN');

  const adminTabLabels: Record<ActiveTab, string> = {
    overview: 'Visão geral',
    users: 'Usuários',
    brokers: 'Corretores',
    tokens: 'Tokens/Mercados',
    withdrawals: 'Saques',
    treasury: 'Tesouraria / Emitir RPC',
    revenues: 'Receitas',
    audit: 'Auditoria',
    reports: 'Relatórios',
  };

  const adminDrawerItems: SideDrawerItem[] = [
    { key: 'overview', label: 'Visão geral', active: tab === 'overview', onClick: () => setTab('overview') },
    { key: 'users', label: 'Usuários', active: tab === 'users', onClick: () => setTab('users') },
    { key: 'brokers', label: 'Corretores', active: tab === 'brokers', onClick: () => setTab('brokers') },
    { key: 'tokens', label: 'Tokens/Mercados', active: tab === 'tokens', onClick: () => setTab('tokens') },
    { key: 'withdrawals', label: 'Saques', active: tab === 'withdrawals', onClick: () => setTab('withdrawals') },
    { key: 'treasury', label: 'Tesouraria / Emitir RPC', active: tab === 'treasury', onClick: () => setTab('treasury') },
    { key: 'revenues', label: 'Receitas', active: tab === 'revenues', onClick: () => setTab('revenues') },
    { key: 'audit', label: 'Auditoria', active: tab === 'audit', onClick: () => setTab('audit') },
    { key: 'reports', label: 'Relatórios', active: tab === 'reports', onClick: () => setTab('reports') },
  ];

  async function submitIssuance(event: FormEvent) {
    event.preventDefault();
    setError('');
    setMessage('');
    setIsSubmittingIssuance(true);

    try {
      await api('/admin/treasury/issuance', { method: 'POST', body: JSON.stringify({ amount: issuanceAmount, reason: issuanceReason }) });
      setIssuanceAmount('');
      setIssuanceReason('');
      await load();
      setMessage('RPC emitido na tesouraria com sucesso.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSubmittingIssuance(false);
    }
  }

  async function submitBrokerTransfer(event: FormEvent) {
    event.preventDefault();
    setError('');
    setMessage('');
    setIsSubmittingBrokerTransfer(true);

    try {
      await api('/admin/treasury/transfer-to-broker', { method: 'POST', body: JSON.stringify({ brokerEmail, amount: brokerAmount, reason: brokerReason }) });
      setBrokerEmail('');
      setBrokerAmount('');
      setBrokerReason('');
      await load();
      setMessage('RPC enviado ao corretor com sucesso.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSubmittingBrokerTransfer(false);
    }
  }



  async function submitPlatformWithdraw(event: FormEvent) {
    event.preventDefault();
    setError('');
    setMessage('');
    setIsSubmittingPlatformWithdraw(true);

    try {
      await api('/admin/platform-account/withdraw-to-admin', {
        method: 'POST',
        body: JSON.stringify({
          adminEmail: platformWithdrawEmail,
          amount: platformWithdrawAmount,
          reason: platformWithdrawReason,
        }),
      });
      setPlatformWithdrawEmail('');
      setPlatformWithdrawAmount('');
      setPlatformWithdrawReason('');
      await load();
      setMessage('Lucro da Exchange transferido com sucesso.');
    } catch (err) {
      setError((err as Error).message || 'Não foi possível transferir o lucro da Exchange.');
    } finally {
      setIsSubmittingPlatformWithdraw(false);
    }
  }

  async function submitUserDeposit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setMessage('');
    setIsSubmittingUserDeposit(true);

    try {
      await api('/admin/treasury/transfer-to-user', {
        method: 'POST',
        body: JSON.stringify({ userEmail: userDepositEmail, amount: userDepositAmount, reason: userDepositReason }),
      });
      setUserDepositEmail('');
      setUserDepositAmount('');
      setUserDepositReason('');
      await load();
      setMessage('RPC depositado na carteira do jogador com sucesso.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSubmittingUserDeposit(false);
    }
  }

  return (
    <section className="card">
      <h2>🛠️ Painel Admin</h2>
      {error && <p className="status-message error">{error}</p>}
      {message && <p className="status-message success">{message}</p>}

      <div className="admin-mobile-menu-row mobile-only">
        <button className="hamburger-button mobile-only" type="button" onClick={() => setIsAdminDrawerOpen(true)} aria-label="Abrir menu admin">☰ Menu Admin</button>
        <strong>{adminTabLabels[tab]}</strong>
      </div>

      <SideDrawer title="Menu Admin" subtitle="Acesso rápido às abas" open={isAdminDrawerOpen} onClose={() => setIsAdminDrawerOpen(false)} items={adminDrawerItems} />

      <nav className="pill-nav nested-card admin-nav desktop-only">
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
          <button className="home-tile" type="button" onClick={() => setTab('treasury')}><span>🪙</span><strong>Tesouraria / Emitir RPC</strong><small>Acessar emissão e transferências administrativas.</small></button>
        </div>
      )}

      {tab === 'users' && <AdminUsersPanel onPermissionsUpdated={onPermissionsUpdated} mode="users" />}
      {tab === 'brokers' && <AdminUsersPanel onPermissionsUpdated={onPermissionsUpdated} mode="brokers" />}
      {tab === 'tokens' && <AdminTokensPanel />}
      {tab === 'withdrawals' && <AdminWithdrawalsPanel />}

      {tab === 'treasury' && (
        <>
          <h3 className="nested-card">Emitir RPC na Tesouraria</h3>
          <p className="info-text">Cria nova moeda RPC fictícia na tesouraria do sistema. Use apenas para controle administrativo do RP.</p>
          {canIssueRpc ? (
          <form onSubmit={submitIssuance} className="form-grid">
            <input value={issuanceAmount} onChange={(e) => setIssuanceAmount(e.target.value)} placeholder="Quantidade" required />
            <input value={issuanceReason} onChange={(e) => setIssuanceReason(e.target.value)} placeholder="Motivo" required />
            <button className="button-primary" type="submit" disabled={isSubmittingIssuance}>{isSubmittingIssuance ? 'Processando...' : 'Emitir RPC'}</button>
          </form>
          ) : (
            <p className="status-message error">Você pode acessar a tesouraria, mas apenas SUPER_ADMIN ou ADM Chefe da Moeda pode emitir RPC.</p>
          )}

          <h3 className="nested-card">Enviar RPC para corretor</h3>
          <form onSubmit={submitBrokerTransfer} className="form-grid">
            <input value={brokerEmail} onChange={(e) => setBrokerEmail(e.target.value)} placeholder="E-mail do corretor" type="email" required />
            <input value={brokerAmount} onChange={(e) => setBrokerAmount(e.target.value)} placeholder="Quantidade RPC" required />
            <input value={brokerReason} onChange={(e) => setBrokerReason(e.target.value)} placeholder="Observação" required />
            <button className="button-primary" type="submit" disabled={isSubmittingBrokerTransfer}>{isSubmittingBrokerTransfer ? 'Processando...' : 'Enviar RPC ao corretor'}</button>
          </form>

          <h3 className="nested-card">Depositar RPC em jogador</h3>
          <form onSubmit={submitUserDeposit} className="form-grid">
            <input value={userDepositEmail} onChange={(e) => setUserDepositEmail(e.target.value)} placeholder="E-mail do jogador" type="email" required />
            <input value={userDepositAmount} onChange={(e) => setUserDepositAmount(e.target.value)} placeholder="Quantidade RPC" required />
            <input value={userDepositReason} onChange={(e) => setUserDepositReason(e.target.value)} placeholder="Motivo" required />
            <button className="button-primary" type="submit" disabled={isSubmittingUserDeposit}>{isSubmittingUserDeposit ? 'Processando...' : 'Depositar RPC no jogador'}</button>
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
              <div className="summary-item"><span className="summary-label">Total retirado</span><strong className="summary-value">{platformAccount.totalWithdrawn}</strong></div>
            </div>
          )}



          {canWithdrawPlatformProfit && (
            <>
              <h3 className="nested-card">Retirar lucro da Exchange</h3>
              <form onSubmit={submitPlatformWithdraw} className="form-grid">
                <input
                  value={platformWithdrawEmail}
                  onChange={(e) => setPlatformWithdrawEmail(e.target.value)}
                  placeholder="E-mail do administrador"
                  type="email"
                  required
                />
                <input
                  value={platformWithdrawAmount}
                  onChange={(e) => setPlatformWithdrawAmount(e.target.value)}
                  placeholder="Quantidade RPC"
                  required
                />
                <input
                  value={platformWithdrawReason}
                  onChange={(e) => setPlatformWithdrawReason(e.target.value)}
                  placeholder="Motivo"
                  required
                />
                <button className="button-primary" type="submit" disabled={isSubmittingPlatformWithdraw}>
                  {isSubmittingPlatformWithdraw ? 'Processando...' : 'Transferir lucro'}
                </button>
              </form>
            </>
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
