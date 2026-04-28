import { FormEvent, useState } from 'react';
import { api } from '../services/api';

const initialForm = {
  name: '', ticker: '', sector: '', description: '', totalShares: '100000', initialPrice: '1', ownerSharePercent: '40', publicOfferPercent: '60', buyFeePercent: '1', sellFeePercent: '1',
};

export function CompanyRequestPage() {
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      await api('/companies/request', { method: 'POST', body: JSON.stringify(form) });
      setMessage('Solicitação de listagem enviada com sucesso. Aguarde aprovação do admin.');
      setError('');
      setForm(initialForm);
    } catch (err) {
      setError((err as Error).message);
      setMessage('');
    }
  }

  return (
    <section className="card">
      <h2>🚀 Criar token</h2>
      <p className="info-text">Crie seu projeto e solicite a listagem do token no mercado.</p>
      <form onSubmit={submit} className="form-grid two-cols nested-card">
        <input placeholder="Nome do projeto" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <input placeholder="Código do token" value={form.ticker} onChange={(e) => setForm({ ...form, ticker: e.target.value.toUpperCase() })} required />
        <input placeholder="Categoria" value={form.sector} onChange={(e) => setForm({ ...form, sector: e.target.value })} required />
        <input placeholder="Total de tokens" type="number" value={form.totalShares} onChange={(e) => setForm({ ...form, totalShares: e.target.value })} required />
        <input placeholder="Preço inicial" type="number" step="0.01" value={form.initialPrice} onChange={(e) => setForm({ ...form, initialPrice: e.target.value })} required />
        <input placeholder="Percentual do criador" type="number" step="0.01" value={form.ownerSharePercent} onChange={(e) => setForm({ ...form, ownerSharePercent: e.target.value })} required />
        <input placeholder="Percentual para lançamento" type="number" step="0.01" value={form.publicOfferPercent} onChange={(e) => setForm({ ...form, publicOfferPercent: e.target.value })} required />
        <input placeholder="Taxa compra (%)" type="number" step="0.01" value={form.buyFeePercent} onChange={(e) => setForm({ ...form, buyFeePercent: e.target.value })} required />
        <input placeholder="Taxa venda (%)" type="number" step="0.01" value={form.sellFeePercent} onChange={(e) => setForm({ ...form, sellFeePercent: e.target.value })} required />
        <textarea placeholder="Descrição do projeto" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required />
        <button className="button-primary" type="submit">Solicitar listagem</button>
      </form>
      <p className="info-text">Após aprovação, seu token será negociado no par CODIGO/RPC.</p>
      {message && <p className="status-message success">{message}</p>}
      {error && <p className="status-message error">{error}</p>}
    </section>
  );
}
