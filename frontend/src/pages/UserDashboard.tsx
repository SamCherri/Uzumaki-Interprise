import { useEffect, useState } from 'react';
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

export function UserDashboard() {
  const [data, setData] = useState<HoldingsResponse | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api<HoldingsResponse>('/me/holdings')
      .then(setData)
      .catch((err: Error) => setError(err.message));
  }, []);

  return (
    <section className="card">
      <h2>Painel do Usuário</h2>
      {error && <p>{error}</p>}
      {data && (
        <div>
          <p><strong>Saldo disponível:</strong> {data.wallet.availableBalance} moedas virtuais</p>
          <p><strong>Empresas investidas:</strong> {data.totalCompanies}</p>
          <ul>
            {data.holdings.map((holding) => (
              <li key={holding.companyId}>
                {holding.companyName} ({holding.ticker}) — {holding.quantity} cotas | Preço médio: {holding.averageBuyPrice} | Valor estimado: {holding.estimatedValue}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
