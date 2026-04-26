import { useEffect, useState } from 'react';
import { api } from '../services/api';

type Overview = {
  users: number;
  companies: number;
  logs: number;
  treasuryBalance: string | number;
};

export function AdminDashboard() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api<Overview>('/admin/overview')
      .then(setData)
      .catch((err: Error) => setError(err.message));
  }, []);

  return (
    <section className="card">
      <h2>Painel Administrativo (básico)</h2>
      {error && <p>{error}</p>}
      {data && (
        <ul>
          <li>Usuários: {data.users}</li>
          <li>Empresas fictícias: {data.companies}</li>
          <li>Logs administrativos: {data.logs}</li>
          <li>Saldo da tesouraria central: {data.treasuryBalance}</li>
        </ul>
      )}
    </section>
  );
}
