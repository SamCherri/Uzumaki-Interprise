import { FormEvent, useEffect, useState } from 'react';
import { api } from '../services/api';

type Overview = {
  users: number;
  companies: number;
  logs: number;
  treasuryBalance: string | number;
};

type Treasury = { balance: string | number };

type UserSummary = { id: string; name: string; email: string };

export function AdminDashboard() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [treasury, setTreasury] = useState<Treasury | null>(null);
  const [brokers, setBrokers] = useState<UserSummary[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [issueAmount, setIssueAmount] = useState<number>(0);
  const [issueReason, setIssueReason] = useState('');

  const [brokerUserId, setBrokerUserId] = useState('');
  const [brokerAmount, setBrokerAmount] = useState<number>(0);
  const [brokerReason, setBrokerReason] = useState('');

  async function load() {
    try {
      const [overviewRes, treasuryRes] = await Promise.all([
        api<Overview>('/admin/overview'),
        api<Treasury>('/economy/treasury'),
      ]);
      setOverview(overviewRes);
      setTreasury(treasuryRes);
      setError('');
    } catch (err) {
      setError((err as Error).message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    api<{ users: UserSummary[] }>('/admin/users/brokers')
      .then((res) => setBrokers(res.users))
      .catch(() => setBrokers([]));
  }, []);

  async function handleIssue(event: FormEvent) {
    event.preventDefault();
    try {
      await api('/economy/treasury/issue', {
        method: 'POST',
        body: JSON.stringify({ amount: issueAmount, reason: issueReason }),
      });
      setMessage('Moeda virtual criada com sucesso na Tesouraria Central.');
      setIssueAmount(0);
      setIssueReason('');
      await load();
    } catch (err) {
      setMessage((err as Error).message);
    }
  }

  async function handleTreasuryToBroker(event: FormEvent) {
    event.preventDefault();
    try {
      await api('/economy/treasury/transfer-broker', {
        method: 'POST',
        body: JSON.stringify({ brokerUserId, amount: brokerAmount, reason: brokerReason }),
      });
      setMessage('Repasse da Tesouraria para corretor virtual concluído.');
      setBrokerAmount(0);
      setBrokerReason('');
      await load();
    } catch (err) {
      setMessage((err as Error).message);
    }
  }

  return (
    <section className="card">
      <h2>Painel Administrativo (Tesouraria)</h2>
      {error && <p>{error}</p>}
      {message && <p>{message}</p>}

      {overview && (
        <ul>
          <li>Usuários: {overview.users}</li>
          <li>Empresas fictícias: {overview.companies}</li>
          <li>Logs administrativos: {overview.logs}</li>
        </ul>
      )}

      <h3>Saldo da Tesouraria Central</h3>
      <p>{treasury?.balance ?? 0} moedas virtuais</p>

      <h3>Criar moeda fictícia na Tesouraria</h3>
      <form onSubmit={handleIssue}>
        <input type="number" step="0.01" min="0.01" value={issueAmount} onChange={(event) => setIssueAmount(Number(event.target.value))} required placeholder="Quantidade" />
        <input value={issueReason} onChange={(event) => setIssueReason(event.target.value)} required placeholder="Motivo obrigatório" />
        <button type="submit">Criar moeda virtual</button>
      </form>

      <h3>Enviar da Tesouraria para Corretor Virtual</h3>
      <form onSubmit={handleTreasuryToBroker}>
        <select value={brokerUserId} onChange={(event) => setBrokerUserId(event.target.value)} required>
          <option value="">Selecione o corretor virtual</option>
          {brokers.map((broker) => (
            <option value={broker.id} key={broker.id}>{broker.name} ({broker.email})</option>
          ))}
        </select>
        <input type="number" step="0.01" min="0.01" value={brokerAmount} onChange={(event) => setBrokerAmount(Number(event.target.value))} required placeholder="Quantidade" />
        <input value={brokerReason} onChange={(event) => setBrokerReason(event.target.value)} required placeholder="Motivo obrigatório" />
        <button type="submit">Enviar para corretor virtual</button>
      </form>
    </section>
  );
}
