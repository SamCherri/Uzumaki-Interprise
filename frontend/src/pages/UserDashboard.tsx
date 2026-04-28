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
              <strong className="summary-value">{moeda(Number(data.wallet.availableBalance))} RPC</strong>
            </div>
            <div className="summary-item">
              <span className="summary-label">Valor estimado</span>
              <strong className="summary-value">{moeda(totalEstimado)} RPC</strong>
            </div>
            <div className="summary-item">
              <span className="summary-label">Tokens investidos</span>
              <strong className="summary-value">{data.totalCompanies}</strong>
            </div>
          </div>

          <div className="mobile-card-list nested-card">
            {data.holdings.length === 0 && <p className="empty-state">Você ainda não possui tokens.</p>}
            {data.holdings.map((holding) => (
              <article key={holding.companyId} className="summary-item finance-card">
                <p className="company-emoji">🪙 {holding.ticker}/RPC</p>
                <strong>{holding.companyName}</strong>
                <p className="info-text">Meus tokens: {holding.quantity}</p>
                <p className="info-text">Preço médio: {moeda(Number(holding.averageBuyPrice))} RPC</p>
                <p className="info-text">Preço atual: {moeda(Number(holding.currentPrice))} RPC</p>
                <p className="info-text">Valor estimado: {moeda(Number(holding.estimatedValue))} RPC</p>
                <button className="quick-pill" type="button" disabled>Ver mercado</button>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
