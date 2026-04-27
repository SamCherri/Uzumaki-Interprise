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

type WalletResponse = {
  wallet: {
    availableBalance: string;
  };
};

function formatMoedas(value: number) {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selected, setSelected] = useState<CompanyDetail | null>(null);
  const [quantity, setQuantity] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [availableBalance, setAvailableBalance] = useState<number | null>(null);

  async function load() {
    try {
      const response = await api<{ companies: Company[] }>('/companies');
      setCompanies(response.companies);
      setError('');
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function loadWallet() {
    try {
      const response = await api<WalletResponse>('/me/holdings');
      const parsedBalance = Number.parseFloat(response.wallet.availableBalance);
      setAvailableBalance(Number.isNaN(parsedBalance) ? null : parsedBalance);
    } catch {
      setAvailableBalance(null);
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
      const quantityValue = Number.parseInt(quantity, 10);
      const unitPrice = Number.parseFloat(selected.initialPrice);
      const buyFeePercent = Number.parseFloat(selected.buyFeePercent);
      const subtotal = quantityValue * unitPrice;
      const feeValue = subtotal * (buyFeePercent / 100);
      const totalPayable = subtotal + feeValue;

      setMessage(
        `Compra realizada: ${quantityValue} cota(s) por ${formatMoedas(totalPayable)} moedas, incluindo ${formatMoedas(feeValue)} de taxa.`,
      );
      setQuantity('');
      await load();
      await loadDetails(selected.id);
      await loadWallet();
      setError('');
    } catch (err) {
      setError((err as Error).message);
      setMessage('');
    }
  }

  useEffect(() => {
    load();
    loadWallet();
  }, []);

  const quantityValue = Number.parseInt(quantity, 10);
  const parsedQuantity = Number.isNaN(quantityValue) ? 0 : quantityValue;
  const unitPrice = selected ? Number.parseFloat(selected.initialPrice) : 0;
  const buyFeePercent = selected ? Number.parseFloat(selected.buyFeePercent) : 0;
  const subtotal = parsedQuantity * unitPrice;
  const feeValue = subtotal * (buyFeePercent / 100);
  const totalPayable = subtotal + feeValue;
  const estimatedBalance = availableBalance !== null ? availableBalance - totalPayable : null;

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
          <p><strong>Preço unitário da cota:</strong> {selected.initialPrice} moeda(s)</p>
          <p>% dono: {selected.ownerSharePercent} | % oferta: {selected.publicOfferPercent}</p>
          <p>Taxa compra: {selected.buyFeePercent}% | Taxa venda: {selected.sellFeePercent}%</p>
          <p>Cotas disponíveis: {selected.initialOffer?.availableShares ?? selected.availableOfferShares}</p>

          <form onSubmit={buy} className="form-grid">
            <label htmlFor="quantity">Quantidade de cotas</label>
            <input
              id="quantity"
              type="number"
              min="1"
              placeholder="Quantidade de cotas"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
            />
            <small>Você está comprando cotas, não valor em moedas.</small>

            <div>
              <p><strong>Resumo da compra</strong></p>
              <p>Quantidade: {parsedQuantity} cota(s)</p>
              <p>Preço unitário da cota: {selected.initialPrice} moeda(s)</p>
              <p>Subtotal: {formatMoedas(subtotal)} moeda(s)</p>
              <p>Taxa de compra: {selected.buyFeePercent}%</p>
              <p>Valor da taxa: {formatMoedas(feeValue)} moeda(s)</p>
              <p><strong>Total a pagar: {formatMoedas(totalPayable)} moeda(s)</strong></p>
              {availableBalance !== null && <p>Saldo atual: {formatMoedas(availableBalance)} moeda(s)</p>}
              {estimatedBalance !== null && <p>Saldo estimado após compra: {formatMoedas(estimatedBalance)} moeda(s)</p>}
            </div>

            <button type="submit">Comprar cotas</button>
          </form>
          {message && <p>{message}</p>}
        </div>
      )}
    </section>
  );
}
