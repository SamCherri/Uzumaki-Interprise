import { FormEvent, useEffect, useState } from 'react';
import { api } from '../services/api';

type Company = {
  id: string;
  name: string;
  ticker: string;
  sector: string;
  initialPrice: string;
  availableOfferShares: number;
  totalShares: number;
  ownerSharePercent: string;
  publicOfferPercent: string;
  buyFeePercent: string;
  sellFeePercent: string;
};

type CompanyDetail = Company & {
  description: string;
  initialOffer?: {
    totalShares: number;
    availableShares: number;
  } | null;
};

export function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selected, setSelected] = useState<CompanyDetail | null>(null);
  const [quantity, setQuantity] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function load() {
    try {
      const response = await api<{ companies: Company[] }>('/companies');
      setCompanies(response.companies);
      setError('');
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function loadDetails(id: string) {
    try {
      const response = await api<{ company: CompanyDetail }>(`/companies/${id}`);
      setSelected(response.company);
      setMessage('');
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function buy(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;

    try {
      await api(`/companies/${selected.id}/buy-initial-offer`, {
        method: 'POST',
        body: JSON.stringify({ quantity }),
      });
      setMessage('Compra realizada com sucesso.');
      setQuantity('');
      await load();
      await loadDetails(selected.id);
      setError('');
    } catch (err) {
      setError((err as Error).message);
      setMessage('');
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <section className="card">
      <h2>Empresas aprovadas</h2>
      {error && <p>{error}</p>}

      <ul>
        {companies.map((company) => (
          <li key={company.id}>
            <strong>{company.name}</strong> ({company.ticker}) — {company.sector} | Preço inicial: {company.initialPrice} | Disponíveis: {company.availableOfferShares}
            <button onClick={() => loadDetails(company.id)}>Ver detalhes</button>
          </li>
        ))}
      </ul>

      {selected && (
        <div className="card nested-card">
          <h3>Detalhes de {selected.name} ({selected.ticker})</h3>
          <p>{selected.description}</p>
          <p>Total de cotas: {selected.totalShares}</p>
          <p>Preço inicial: {selected.initialPrice}</p>
          <p>% dono: {selected.ownerSharePercent} | % oferta: {selected.publicOfferPercent}</p>
          <p>Taxa compra: {selected.buyFeePercent}% | Taxa venda: {selected.sellFeePercent}%</p>
          <p>Cotas disponíveis: {selected.initialOffer?.availableShares ?? selected.availableOfferShares}</p>

          <form onSubmit={buy} className="form-grid">
            <input type="number" min="1" placeholder="Quantidade de cotas" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
            <button type="submit">Comprar na oferta inicial</button>
          </form>
          {message && <p>{message}</p>}
        </div>
      )}
    </section>
  );
}
