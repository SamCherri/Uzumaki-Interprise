import { FormEvent, useEffect, useState } from 'react';
import { api } from '../services/api';

type Overview = {
  users: number;
  companies: number;
  logs: number;
  treasuryBalance: string | number;
};

type PendingCompany = {
  id: string;
  name: string;
  ticker: string;
  ownerSharePercent: string;
  publicOfferPercent: string;
  buyFeePercent: string;
  sellFeePercent: string;
  ownerShares: number;
  publicOfferShares: number;
};

export function AdminDashboard() {
  const [data, setData] = useState<Overview | null>(null);
  const [pending, setPending] = useState<PendingCompany[]>([]);
  const [error, setError] = useState('');

  const [issuanceAmount, setIssuanceAmount] = useState('');
  const [issuanceReason, setIssuanceReason] = useState('');
  const [brokerEmail, setBrokerEmail] = useState('');
  const [brokerAmount, setBrokerAmount] = useState('');
  const [brokerReason, setBrokerReason] = useState('');

  async function load() {
    try {
      const [overview, pendingCompanies] = await Promise.all([
        api<Overview>('/admin/overview'),
        api<{ companies: PendingCompany[] }>('/admin/companies/pending'),
      ]);
      setData(overview);
      setPending(pendingCompanies.companies);
      setError('');
    } catch (err) {
      setError((err as Error).message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function submitIssuance(event: FormEvent) {
    event.preventDefault();
    try {
      await api('/admin/treasury/issuance', { method: 'POST', body: JSON.stringify({ amount: issuanceAmount, reason: issuanceReason }) });
      setIssuanceAmount('');
      setIssuanceReason('');
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function submitBrokerTransfer(event: FormEvent) {
    event.preventDefault();
    try {
      await api('/admin/treasury/transfer-to-broker', {
        method: 'POST',
        body: JSON.stringify({ brokerEmail, amount: brokerAmount, reason: brokerReason }),
      });
      setBrokerEmail('');
      setBrokerAmount('');
      setBrokerReason('');
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function moderateCompany(id: string, action: 'approve' | 'reject' | 'suspend') {
    try {
      await api(`/admin/companies/${id}/${action}`, { method: 'POST' });
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <section className="card">
      <h2>Painel Administrativo</h2>
      {error && <p>{error}</p>}
      {data && (
        <ul>
          <li>Usuários: {data.users}</li>
          <li>Empresas fictícias: {data.companies}</li>
          <li>Logs administrativos: {data.logs}</li>
          <li>Saldo da tesouraria central: {data.treasuryBalance}</li>
        </ul>
      )}

      <h3>Empresas pendentes</h3>
      <ul>
        {pending.map((company) => (
          <li key={company.id}>
            <strong>{company.name}</strong> ({company.ticker}) | Dono: {company.ownerSharePercent}% ({company.ownerShares} cotas) | Oferta: {company.publicOfferPercent}% ({company.publicOfferShares} cotas)
            <br />
            Taxa compra: {company.buyFeePercent}% | Taxa venda: {company.sellFeePercent}%
            <div className="inline-actions">
              <button onClick={() => moderateCompany(company.id, 'approve')}>Aprovar</button>
              <button onClick={() => moderateCompany(company.id, 'reject')}>Rejeitar</button>
              <button onClick={() => moderateCompany(company.id, 'suspend')}>Suspender</button>
            </div>
          </li>
        ))}
      </ul>

      <h3>Emitir moeda fictícia para tesouraria</h3>
      <form onSubmit={submitIssuance} className="form-grid">
        <input value={issuanceAmount} onChange={(e) => setIssuanceAmount(e.target.value)} placeholder="Quantidade" required />
        <input value={issuanceReason} onChange={(e) => setIssuanceReason(e.target.value)} placeholder="Motivo" required />
        <button type="submit">Criar moeda</button>
      </form>

      <h3>Enviar moeda da tesouraria para corretor</h3>
      <form onSubmit={submitBrokerTransfer} className="form-grid">
        <input value={brokerEmail} onChange={(e) => setBrokerEmail(e.target.value)} placeholder="E-mail do corretor" type="email" required />
        <input value={brokerAmount} onChange={(e) => setBrokerAmount(e.target.value)} placeholder="Quantidade" required />
        <input value={brokerReason} onChange={(e) => setBrokerReason(e.target.value)} placeholder="Motivo" required />
        <button type="submit">Enviar ao corretor</button>
      </form>
    </section>
  );
}
