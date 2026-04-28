import { FormEvent, useEffect, useState } from 'react';
import { api } from '../services/api';

type TokenRow = {
  id: string;
  name: string;
  ticker: string;
  sector: string;
  status: string;
  founder: { id: string; name: string; email: string };
  currentPrice: string | number;
  totalTokens: number;
  availableTokens: number;
};

export function AdminTokensPanel() {
  const [tokens, setTokens] = useState<TokenRow[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const emptyForm = {
    founderEmail: '',
    name: '',
    ticker: '',
    description: '',
    sector: '',
    totalTokens: '',
    ownerSharePercent: '',
    publicOfferPercent: '',
    initialPrice: '',
    buyFeePercent: '',
    sellFeePercent: '',
  };

  const [form, setForm] = useState(emptyForm);

  async function loadTokens() {
    setError('');
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (status) params.set('status', status);

    const query = params.toString() ? `?${params.toString()}` : '';
    const data = await api<{ tokens: TokenRow[] }>(`/admin/tokens${query}`);
    setTokens(data.tokens);
  }

  useEffect(() => {
    loadTokens().catch((err) => setError((err as Error).message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createToken(event: FormEvent) {
    event.preventDefault();
    setError('');
    setMessage('');
    try {
      await api('/admin/tokens', { method: 'POST', body: JSON.stringify(form) });
      setForm(emptyForm);
      setMessage('Token criado com sucesso.');
      await loadTokens();
    } catch (err) {
      setError((err as Error).message);
    }
  }


  async function approveOrRejectToken(id: string, action: 'approve' | 'reject') {
    setError('');
    setMessage('');
    try {
      await api(`/admin/companies/${id}/${action}`, { method: 'POST' });
      setMessage(action === 'approve' ? 'Listagem aprovada com sucesso.' : 'Listagem rejeitada com sucesso.');
      await loadTokens();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function actionToken(id: string, action: 'suspend' | 'reactivate' | 'close') {
    setError('');
    setMessage('');
    const reason = window.prompt('Informe o motivo da ação:');
    if (!reason) return;
    try {
      await api(`/admin/tokens/${id}/${action}`, { method: 'PATCH', body: JSON.stringify({ reason }) });
      setMessage('Ação executada com sucesso.');
      await loadTokens();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function changeOwner(id: string) {
    const founderEmail = window.prompt('Novo e-mail do responsável:');
    if (!founderEmail) return;
    const reason = window.prompt('Motivo da troca de responsável:');
    if (!reason) return;
    setError('');
    setMessage('');
    try {
      await api(`/admin/tokens/${id}/owner`, { method: 'PATCH', body: JSON.stringify({ founderEmail, reason }) });
      setMessage('Dono alterado com sucesso.');
      await loadTokens();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function deleteToken(id: string) {
    setError('');
    setMessage('');
    const confirmText = window.confirm('Esta ação só é permitida para mercados sem histórico econômico. Deseja continuar?');
    if (!confirmText) return;
    try {
      await api(`/admin/tokens/${id}`, { method: 'DELETE' });
      setMessage('Token removido definitivamente.');
      await loadTokens();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <section className="nested-card">
      <h3>Tokens/Mercados</h3>
      {message && <p className="status-message">{message}</p>}
      {error && <p className="status-message error">{error}</p>}

      <form className="form-grid two-cols" onSubmit={(event) => { event.preventDefault(); loadTokens(); }}>
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por ticker/nome" />
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">Todos os status</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="SUSPENDED">SUSPENDED</option>
          <option value="CLOSED">CLOSED</option>
          <option value="REJECTED">REJECTED</option>
          <option value="BANKRUPT">BANKRUPT</option>
        </select>
        <button className="button-primary" type="submit">Filtrar mercados</button>
      </form>

      <h3 className="nested-card">Criar token manualmente</h3>
      <form className="form-grid two-cols" onSubmit={createToken}>
        <input value={form.founderEmail} onChange={(event) => setForm((prev) => ({ ...prev, founderEmail: event.target.value }))} placeholder="E-mail do dono do projeto" required />
        <input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} placeholder="Nome do projeto" required />
        <input value={form.ticker} onChange={(event) => setForm((prev) => ({ ...prev, ticker: event.target.value.toUpperCase() }))} placeholder="Código do token" required />
        <input value={form.sector} onChange={(event) => setForm((prev) => ({ ...prev, sector: event.target.value }))} placeholder="Categoria" required />
        <textarea value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} placeholder="Descrição do projeto" required />
        <input value={form.totalTokens} onChange={(event) => setForm((prev) => ({ ...prev, totalTokens: event.target.value }))} placeholder="Total de tokens" required />
        <input value={form.ownerSharePercent} onChange={(event) => setForm((prev) => ({ ...prev, ownerSharePercent: event.target.value }))} placeholder="Percentual do criador" required />
        <input value={form.publicOfferPercent} onChange={(event) => setForm((prev) => ({ ...prev, publicOfferPercent: event.target.value }))} placeholder="Percentual para lançamento" required />
        <input value={form.initialPrice} onChange={(event) => setForm((prev) => ({ ...prev, initialPrice: event.target.value }))} placeholder="Preço inicial" required />
        <input value={form.buyFeePercent} onChange={(event) => setForm((prev) => ({ ...prev, buyFeePercent: event.target.value }))} placeholder="Taxa compra (%)" required />
        <input value={form.sellFeePercent} onChange={(event) => setForm((prev) => ({ ...prev, sellFeePercent: event.target.value }))} placeholder="Taxa venda (%)" required />
        <button className="button-success" type="submit">Criar token</button>
      </form>

      <div className="mobile-card-list nested-card">
        {tokens.map((token) => (
          <article key={token.id} className="summary-item compact-card">
            <strong>{token.name} ({token.ticker})</strong>
            <p>Status: {token.status}</p>
            <p>Dono: {token.founder.name} ({token.founder.email})</p>
            <p>Preço atual: {token.currentPrice}</p>
            <p>Total tokens: {token.totalTokens} · Disponível: {token.availableTokens}</p>
            <div className="action-grid">
              {token.status === 'PENDING' && (
                <>
                  <button className="button-success" type="button" onClick={() => approveOrRejectToken(token.id, 'approve')}>Aprovar listagem</button>
                  <button className="button-danger" type="button" onClick={() => approveOrRejectToken(token.id, 'reject')}>Rejeitar listagem</button>
                </>
              )}
              {token.status === 'ACTIVE' && (
                <>
                  <button className="button-primary" type="button" onClick={() => actionToken(token.id, 'suspend')}>Pausar mercado</button>
                  <button className="button-danger" type="button" onClick={() => {
                    if (window.confirm('Encerrar este mercado bloqueará novas negociações e cancelará ordens abertas, mas manterá histórico e carteiras.')) {
                      actionToken(token.id, 'close');
                    }
                  }}>Encerrar mercado</button>
                  <button className="button-primary" type="button" onClick={() => changeOwner(token.id)}>Trocar dono</button>
                </>
              )}
              {token.status === 'SUSPENDED' && (
                <>
                  <button className="button-success" type="button" onClick={() => actionToken(token.id, 'reactivate')}>Reativar mercado</button>
                  <button className="button-danger" type="button" onClick={() => {
                    if (window.confirm('Encerrar este mercado bloqueará novas negociações e cancelará ordens abertas, mas manterá histórico e carteiras.')) {
                      actionToken(token.id, 'close');
                    }
                  }}>Encerrar mercado</button>
                  <button className="button-primary" type="button" onClick={() => changeOwner(token.id)}>Trocar dono</button>
                </>
              )}
              {token.status === 'CLOSED' && (
                <>
                  <button className="button-danger" type="button" onClick={() => deleteToken(token.id)}>Excluir definitivamente</button>
                  <p className="info-text">A exclusão só é permitida se o backend confirmar ausência de histórico econômico.</p>
                </>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
