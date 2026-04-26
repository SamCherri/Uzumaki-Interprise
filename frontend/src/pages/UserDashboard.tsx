import { useEffect, useState } from 'react';
import { api } from '../services/api';

type MeResponse = {
  name: string;
  email: string;
  roles: string[];
  wallet: {
    availableBalance: string;
    lockedBalance: string;
    investedValue: string;
    fictitiousProfit: string;
  } | null;
};

export function UserDashboard() {
  const [data, setData] = useState<MeResponse | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api<MeResponse>('/me')
      .then(setData)
      .catch((err: Error) => setError(err.message));
  }, []);

  return (
    <section className="card">
      <h2>Painel do Usuário</h2>
      {error && <p>{error}</p>}
      {data && (
        <div>
          <p><strong>Nome:</strong> {data.name}</p>
          <p><strong>Saldo disponível:</strong> {data.wallet?.availableBalance ?? '0'} moedas virtuais</p>
          <p><strong>Saldo bloqueado:</strong> {data.wallet?.lockedBalance ?? '0'} moedas virtuais</p>
          <p><strong>Patrimônio fictício:</strong> {data.wallet?.investedValue ?? '0'} moedas virtuais</p>
        </div>
      )}
    </section>
  );
}
