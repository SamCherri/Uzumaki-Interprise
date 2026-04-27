import { useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';

type Holding = {
  companyId: string;
  companyName: string;
  ticker: string;
  quantity: number;
  averageBuyPrice: string;
  estimatedValue: string;
  currentPrice: string;
};

type HoldingsResponse = {
  wallet: { availableBalance: string };
  holdings: Holding[];
  totalCompanies: number;
};

function moeda(value: number) {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function UserDashboard() {
  const [data, setData] = useState<HoldingsResponse | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api<HoldingsResponse>('/me/holdings')
      .then(setData)
      .catch((err: Error) => setError(err.message));
  }, []);

  const totalEstimado = useMemo(
    () => data?.holdings.reduce((acc, holding) => acc + Number(holding.estimatedValue), 0) ?? 0,
    [data],
  );

  return (
    <section className="card">
      <h2>💼 Carteira</h2>
      {error && <p className="status-message error">{error}</p>}

      {data && (
        <>
          <div className="summary-grid nested-card">
            <div className="summary-item">
              <span className="summary-label">Saldo disponível</span>
              <strong className="summary-value">{moeda(Number(data.wallet.availableBalance))} moedas</strong>
            </div>
            <div className="summary-item">
              <span className="summary-label">Empresas investidas</span>
              <strong className="summary-value">{data.totalCompanies}</strong>
            </div>
            <div className="summary-item">
              <span className="summary-label">Valor estimado da carteira</span>
              <strong className="summary-value">{moeda(totalEstimado)} moedas</strong>
            </div>
          </div>

          <div className="mobile-card-list nested-card">
            {data.holdings.length === 0 && <p className="info-text">Você ainda não possui cotas compradas.</p>}
            {data.holdings.map((holding) => (
              <article key={holding.companyId} className="summary-item">
                <p className="company-emoji">🏢 {holding.ticker}</p>
                <strong>{holding.companyName}</strong>
                <p className="info-text">Cotas: {holding.quantity}</p>
                <p className="info-text">Preço médio: {moeda(Number(holding.averageBuyPrice))}</p>
                <p className="info-text">Preço atual: {moeda(Number(holding.currentPrice))}</p>
                <p className="info-text">Valor estimado: {moeda(Number(holding.estimatedValue))}</p>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
