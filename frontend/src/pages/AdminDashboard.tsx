import { FormEvent, useEffect, useState } from 'react';
import { api } from '../services/api';

type Overview = { users: number; companies: number; logs: number; treasuryBalance: string | number };
type PendingCompany = { id: string; name: string; ticker: string; ownerSharePercent: string; publicOfferPercent: string; buyFeePercent: string; sellFeePercent: string; ownerShares: number; publicOfferShares: number };
type PlatformAccount = { balance: string | number; totalReceivedFees: string | number };
type CompanyRevenueAccount = {
  companyId: string;
  ticker: string;
  companyName: string;
  balance: string | number;
  totalReceivedFees: string | number;
  totalWithdrawn: string | number;
};

export function AdminDashboard() {
  const [data, setData] = useState<Overview | null>(null);
  const [pending, setPending] = useState<PendingCompany[]>([]);
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
      const [overview, pendingCompanies, platform, companyRevenue] = await Promise.all([
        api<Overview>('/admin/overview'),
        api<{ companies: PendingCompany[] }>('/admin/companies/pending'),
        api<PlatformAccount>('/admin/platform-account'),
        api<{ accounts: CompanyRevenueAccount[] }>('/admin/company-revenue-accounts'),
      ]);
      setData(overview);
      setPending(pendingCompanies.companies);
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

  async function moderateCompany(id: string, action: 'approve' | 'reject') {
    await api(`/admin/companies/${id}/${action}`, { method: 'POST' });
    await load();
  }

  return (
    <section className="card">
      <h2>🛠️ Painel Admin</h2>
      {error && <p className="status-message error">{error}</p>}

      {data && (
        <div className="summary-grid">
          <div className="summary-item"><span className="summary-label">Usuários</span><strong className="summary-value">{data.users}</strong></div>
          <div className="summary-item"><span className="summary-label">Mercados listados</span><strong className="summary-value">{data.companies}</strong></div>
          <div className="summary-item"><span className="summary-label">Logs</span><strong className="summary-value">{data.logs}</strong></div>
          <div className="summary-item"><span className="summary-label">Tesouraria RPC</span><strong className="summary-value">{data.treasuryBalance}</strong></div>
        </div>
      )}

      <h3 className="nested-card">Receita da Plataforma</h3>
      {platformAccount && (
        <div className="summary-grid">
          <div className="summary-item"><span className="summary-label">Saldo</span><strong className="summary-value">{platformAccount.balance}</strong></div>
          <div className="summary-item"><span className="summary-label">Taxas recebidas</span><strong className="summary-value">{platformAccount.totalReceivedFees}</strong></div>
        </div>
      )}

      <h3 className="nested-card">Receita dos projetos/tokens</h3>
      {companyRevenueAccounts.length === 0 && <p className="empty-state">Nenhuma carteira de receita criada ainda.</p>}
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

      <h3 className="nested-card">Listagens pendentes</h3>
      {pending.length === 0 && <p className="empty-state">Nenhuma listagem pendente no momento.</p>}
      <div className="mobile-card-list">
        {pending.map((company) => (
          <article key={company.id} className="summary-item compact-card">
            <strong>{company.name} ({company.ticker})</strong>
            <p>Projeto/token criado por usuário.</p>
            <p>Criador do token: {company.ownerSharePercent}% ({company.ownerShares})</p>
            <p>Lançamento: {company.publicOfferPercent}% ({company.publicOfferShares})</p>
            <p>Taxas: compra {company.buyFeePercent}% · venda {company.sellFeePercent}%</p>
            <p>Código do token: {company.ticker}</p>
            <div className="action-grid">
              <button className="button-success" onClick={() => moderateCompany(company.id, 'approve')}>Aprovar listagem</button>
              <button className="button-danger" onClick={() => moderateCompany(company.id, 'reject')}>Rejeitar listagem</button>
            </div>
          </article>
        ))}
      </div>

      <h3 className="nested-card">Emitir RPC</h3>
      <form onSubmit={submitIssuance} className="form-grid">
        <input value={issuanceAmount} onChange={(e) => setIssuanceAmount(e.target.value)} placeholder="Quantidade" required />
        <input value={issuanceReason} onChange={(e) => setIssuanceReason(e.target.value)} placeholder="Motivo" required />
        <button className="button-primary" type="submit">Emitir RPC</button>
      </form>

      <h3 className="nested-card">Enviar RPC para corretor</h3>
      <form onSubmit={submitBrokerTransfer} className="form-grid">
        <input value={brokerEmail} onChange={(e) => setBrokerEmail(e.target.value)} placeholder="E-mail do corretor" type="email" required />
        <input value={brokerAmount} onChange={(e) => setBrokerAmount(e.target.value)} placeholder="Quantidade" required />
        <input value={brokerReason} onChange={(e) => setBrokerReason(e.target.value)} placeholder="Motivo" required />
        <button className="button-primary" type="submit">Enviar RPC ao corretor</button>
      </form>
    </section>
  );
}
