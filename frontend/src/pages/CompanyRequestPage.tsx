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
      setMessage('Solicitação enviada com sucesso. Aguarde aprovação do admin.');
      setError('');
      setForm(initialForm);
    } catch (err) {
      setError((err as Error).message);
      setMessage('');
    }
  }

  return (
    <section className="card">
      <h2>🏦 Solicitar empresa</h2>
      <p className="info-text">Preencha os dados da empresa fictícia para análise administrativa.</p>
      <form onSubmit={submit} className="form-grid two-cols nested-card">
        <input placeholder="Nome da empresa" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <input placeholder="Ticker" value={form.ticker} onChange={(e) => setForm({ ...form, ticker: e.target.value.toUpperCase() })} required />
        <input placeholder="Setor" value={form.sector} onChange={(e) => setForm({ ...form, sector: e.target.value })} required />
        <input placeholder="Total de cotas" type="number" value={form.totalShares} onChange={(e) => setForm({ ...form, totalShares: e.target.value })} required />
        <input placeholder="Preço inicial" type="number" step="0.01" value={form.initialPrice} onChange={(e) => setForm({ ...form, initialPrice: e.target.value })} required />
        <input placeholder="% dono" type="number" step="0.01" value={form.ownerSharePercent} onChange={(e) => setForm({ ...form, ownerSharePercent: e.target.value })} required />
        <input placeholder="% oferta inicial" type="number" step="0.01" value={form.publicOfferPercent} onChange={(e) => setForm({ ...form, publicOfferPercent: e.target.value })} required />
        <input placeholder="Taxa compra (%)" type="number" step="0.01" value={form.buyFeePercent} onChange={(e) => setForm({ ...form, buyFeePercent: e.target.value })} required />
        <input placeholder="Taxa venda (%)" type="number" step="0.01" value={form.sellFeePercent} onChange={(e) => setForm({ ...form, sellFeePercent: e.target.value })} required />
        <textarea placeholder="Descrição da empresa" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required />
        <button className="button-primary" type="submit">Solicitar empresa</button>
      </form>
      {message && <p className="status-message success">{message}</p>}
      {error && <p className="status-message error">{error}</p>}
    </section>
  );
}
