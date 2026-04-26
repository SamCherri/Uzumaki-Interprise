import { FormEvent, useEffect, useState } from 'react';
import { api } from '../services/api';

type Overview = {
  users: number;
  companies: number;
  logs: number;
  treasuryBalance: string | number;
};

type CoinHistory = {
  issuances: Array<{ id: string; amount: string; reason: string; createdAt: string; createdById: string }>;
  transfers: Array<{ id: string; type: string; amount: string; reason: string; createdAt: string; receiverId: string | null }>;
};

export function AdminDashboard() {
  const [data, setData] = useState<Overview | null>(null);
  const [history, setHistory] = useState<CoinHistory | null>(null);
  const [error, setError] = useState('');

  const [issuanceAmount, setIssuanceAmount] = useState('');
  const [issuanceReason, setIssuanceReason] = useState('');

  const [brokerUserId, setBrokerUserId] = useState('');
  const [brokerAmount, setBrokerAmount] = useState('');
  const [brokerReason, setBrokerReason] = useState('');

  async function load() {
    try {
      const [overview, coinHistory] = await Promise.all([
        api<Overview>('/admin/overview'),
        api<CoinHistory>('/admin/coin-history'),
      ]);
      setData(overview);
      setHistory(coinHistory);
      setError('');
    } catch (err) {
      setError((err as Error).message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function submitIssuance(event: FormEvent) {
    event.preventDefault();
    try {
      await api('/admin/treasury/issuance', {
        method: 'POST',
        body: JSON.stringify({ amount: issuanceAmount, reason: issuanceReason }),
      });
      setIssuanceAmount('');
      setIssuanceReason('');
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function submitBrokerTransfer(event: FormEvent) {
    event.preventDefault();
    try {
      await api('/admin/treasury/transfer-to-broker', {
        method: 'POST',
        body: JSON.stringify({ brokerUserId, amount: brokerAmount, reason: brokerReason }),
      });
      setBrokerUserId('');
      setBrokerAmount('');
      setBrokerReason('');
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <section className="card">
      <h2>Painel Administrativo (Fase 2)</h2>
      {error && <p>{error}</p>}
      {data && (
        <ul>
          <li>Usuários: {data.users}</li>
          <li>Empresas fictícias: {data.companies}</li>
          <li>Logs administrativos: {data.logs}</li>
          <li>Saldo da tesouraria central: {data.treasuryBalance}</li>
        </ul>
      )}

      <h3>Emitir moeda fictícia para tesouraria</h3>
      <form onSubmit={submitIssuance} className="form-grid">
        <input value={issuanceAmount} onChange={(e) => setIssuanceAmount(e.target.value)} placeholder="Quantidade" required />
        <input value={issuanceReason} onChange={(e) => setIssuanceReason(e.target.value)} placeholder="Motivo" required />
        <button type="submit">Criar moeda</button>
      </form>

      <h3>Enviar moeda da tesouraria para corretor</h3>
      <form onSubmit={submitBrokerTransfer} className="form-grid">
        <input value={brokerUserId} onChange={(e) => setBrokerUserId(e.target.value)} placeholder="ID do corretor" required />
        <input value={brokerAmount} onChange={(e) => setBrokerAmount(e.target.value)} placeholder="Quantidade" required />
        <input value={brokerReason} onChange={(e) => setBrokerReason(e.target.value)} placeholder="Motivo" required />
        <button type="submit">Enviar ao corretor</button>
      </form>

      <h3>Histórico básico</h3>
      {history && (
        <div>
          <p><strong>Emissões:</strong></p>
          <ul>
            {history.issuances.slice(0, 5).map((item) => (
              <li key={item.id}>{item.amount} moedas - {item.reason} ({new Date(item.createdAt).toLocaleString()})</li>
            ))}
          </ul>

          <p><strong>Transferências:</strong></p>
          <ul>
            {history.transfers.slice(0, 5).map((item) => (
              <li key={item.id}>{item.type} - {item.amount} moedas - {item.reason}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
