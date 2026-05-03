import { FormEvent, useEffect, useState } from 'react';
import { api } from '../services/api';
import { formatCurrency, formatPrice } from '../utils/formatters';
import { translateCompanyStatus } from '../utils/labels';

type Entry = { id: string; amountRpc: string; reason: string; createdAt: string };
type Company = { id: string; name: string; ticker: string; status: string; revenueAccount?: { balance: string }; capitalFlowEntries?: Entry[] };

export function ProjectOwnerPanel() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [amountRpc, setAmountRpc] = useState('');
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const load = async () => {
    const response = await api<{ companies: Company[] }>('/project-capital-flow/my-projects');
    setCompanies(response.companies);

    const nextSelected = response.companies.find((company) => company.id === selectedId)?.id ?? response.companies[0]?.id ?? '';
    setSelectedId(nextSelected);
  };

  useEffect(() => {
    load().catch((err) => setError((err as Error).message));
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!selectedId) return;
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const response = await api<{ amountRpc: string }>(`/project-capital-flow/companies/${selectedId}/contribute`, { method: 'POST', body: JSON.stringify({ amountRpc, reason }) });
      setMessage(`Aporte realizado com sucesso: ${formatCurrency(Number(response.amountRpc))} RPC transferidos para o caixa institucional.`);
      setError('');
      setAmountRpc('');
      setReason('');
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return <section className="card"><h2>Meus Projetos</h2>{error && <p className="status-message error">{error}</p>}{message && <p className="status-message success">{message}</p>}{companies.length === 0 && <><p className="info-text">Você ainda não possui projetos ativos.</p><p className="info-text">Para injetar no seu projeto, primeiro você precisa ter RPC na carteira. O fluxo correto é: R$ fictício → RPC → aporte no projeto.</p></>}<div className="mobile-card-list">{companies.map((c) => <article key={c.id} className="summary-item compact-card"><strong>{c.ticker} - {c.name}</strong><p>Status: {translateCompanyStatus(c.status)}</p><p>Caixa RPC do projeto: {formatCurrency(Number(c.revenueAccount?.balance ?? 0))}</p><p>Últimos aportes: {c.capitalFlowEntries?.length ?? 0}</p></article>)}</div>{selectedId && <form onSubmit={submit} className="form-grid"><select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} required>{companies.map((c) => <option key={c.id} value={c.id}>{c.ticker} - {c.name}</option>)}</select><input value={amountRpc} onChange={(e) => setAmountRpc(e.target.value)} placeholder="Valor RPC" required /><input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motivo do aporte (mínimo 10 caracteres)" minLength={10} required /><p className="info-text">Este aporte usa RPC real já existente na sua carteira.</p><p className="info-text">Este aporte não altera o preço do token.</p><p className="info-text">O preço só muda por compra executada na oferta inicial ou trade real no mercado secundário.</p><button className="button-primary" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Processando...' : 'Aportar RPC no projeto'}</button></form>}</section>;
}
