import { FormEvent, useEffect, useState } from 'react';
import { api } from '../services/api';

type Company = { id: string; name: string; ticker: string; status: string; currentPrice: string; fictitiousMarketCap: string; boostAccount?: { rpcBalance: string; totalInjectedRpc: string }; revenueAccount?: { balance: string; totalReceivedFees: string; totalUsedForBoost: string } };

export function ProjectOwnerPanel() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [amountRpc, setAmountRpc] = useState('');
  const [source, setSource] = useState<'PERSONAL_WALLET' | 'PROJECT_REVENUE'>('PERSONAL_WALLET');
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    const response = await api<{ companies: Company[] }>('/project-boosts/my-projects');
    setCompanies(response.companies);
    if (!selectedId && response.companies[0]) setSelectedId(response.companies[0].id);
  };

  useEffect(() => { load().catch((err) => setError((err as Error).message)); }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      const response = await api<{ message: string; priceBefore: string; priceAfter: string }>(`/project-boosts/companies/${selectedId}/boost`, { method: 'POST', body: JSON.stringify({ amountRpc, source, reason }) });
      setMessage(`${response.message} Preço antes: ${response.priceBefore} | depois: ${response.priceAfter}`);
      setError('');
      setAmountRpc('');
      setReason('');
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return <section className="card"><h2>Meus Projetos</h2>{error && <p className="status-message error">{error}</p>}{message && <p className="status-message success">{message}</p>}<div className="mobile-card-list">{companies.map((c) => <article key={c.id} className="summary-item compact-card"><strong>{c.ticker} - {c.name}</strong><p>Status: {c.status}</p><p>Preço: {c.currentPrice} RPC</p><p>Market cap: {c.fictitiousMarketCap}</p><p>Receita projeto: {c.revenueAccount?.balance ?? '0'}</p><p>Reserva boost: {c.boostAccount?.rpcBalance ?? '0'}</p><p>Total impulsionado: {c.boostAccount?.totalInjectedRpc ?? '0'}</p></article>)}</div><form onSubmit={submit} className="form-grid"><select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} required>{companies.map((c) => <option key={c.id} value={c.id}>{c.ticker} - {c.name}</option>)}</select><input value={amountRpc} onChange={(e) => setAmountRpc(e.target.value)} placeholder="Valor RPC" required /><select value={source} onChange={(e) => setSource(e.target.value as any)}><option value="PERSONAL_WALLET">Minha carteira pessoal</option><option value="PROJECT_REVENUE">Receita do projeto</option></select><input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motivo" required /><p className="info-text">Esta ação é definitiva. Você não receberá tokens e não poderá vender essa injeção.</p><button className="button-primary" type="submit">Confirmar impulsão</button></form></section>;
}
