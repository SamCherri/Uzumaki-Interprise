import { useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';
import { formatCurrency, formatPrice } from '../utils/formatters';

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
  wallet: { availableBalance: string; lockedBalance: string; pendingWithdrawalBalance: string };
  holdings: Holding[];
  totalCompanies: number;
};

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
              <span className="summary-label">Saldo disponível RPC</span>
              <strong className="summary-value">{formatCurrency(Number(data.wallet.availableBalance))} RPC</strong>
            </div>
            <div className="summary-item">
              <span className="summary-label">Bloqueado em ordens RPC</span>
              <strong className="summary-value">{formatCurrency(Number(data.wallet.lockedBalance))} RPC</strong>
            </div>
            <div className="summary-item">
              <span className="summary-label">Pendente de saque RPC</span>
              <strong className="summary-value">{formatCurrency(Number(data.wallet.pendingWithdrawalBalance))} RPC</strong>
            </div>
            <div className="summary-item">
              <span className="summary-label">Valor estimado em tokens</span>
              <strong className="summary-value">{formatCurrency(totalEstimado)} RPC</strong>
            </div>
            <div className="summary-item">
              <span className="summary-label">Tokens investidos</span>
              <strong className="summary-value">{data.totalCompanies}</strong>
            </div>
          </div>

          {data.holdings.length > 0 && (
            <p className="info-text">
              Projetos desligados não aparecem na carteira comum. O histórico permanece registrado para auditoria.
            </p>
          )}

          <div className="mobile-card-list nested-card">
            {data.holdings.length === 0 && <p className="empty-state">Você ainda não possui tokens.</p>}
            {data.holdings.map((holding) => (
              <article key={holding.companyId} className="summary-item finance-card">
                <p className="company-emoji">🪙 {holding.ticker}/RPC</p>
                <strong>{holding.companyName}</strong>
                <p className="info-text">Meus tokens: {holding.quantity}</p>
                <p className="info-text">Preço médio: {formatPrice(Number(holding.averageBuyPrice))} RPC</p>
                <p className="info-text">Preço atual: {formatPrice(Number(holding.currentPrice))} RPC</p>
                <p className="info-text">Valor estimado: {formatCurrency(Number(holding.estimatedValue))} RPC</p>
                <button className="quick-pill" type="button" disabled>Ver mercado</button>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
