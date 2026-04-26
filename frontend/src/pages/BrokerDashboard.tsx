import { FormEvent, useEffect, useState } from 'react';
import { api } from '../services/api';

type BrokerBalanceResponse = {
  available: string | number;
  receivedTotal: string | number;
  history: Array<{
    id: string;
    type: string;
    amount: string | number;
    reason: string;
    createdAt: string;
  }>;
};

type UserSimple = { id: string; name: string; email: string };

export function BrokerDashboard() {
  const [data, setData] = useState<BrokerBalanceResponse | null>(null);
  const [users, setUsers] = useState<UserSimple[]>([]);
  const [userId, setUserId] = useState('');
  const [amount, setAmount] = useState<number>(0);
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');

  async function load() {
    try {
      const [balance, usersResponse] = await Promise.all([
        api<BrokerBalanceResponse>('/economy/broker/balance'),
        api<{ users: UserSimple[] }>('/economy/broker/users'),
      ]);
      setData(balance);
      setUsers(usersResponse.users);
      setMessage('');
    } catch (error) {
      setMessage((error as Error).message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleTransfer(event: FormEvent) {
    event.preventDefault();
    try {
      await api('/economy/broker/transfer-user', {
        method: 'POST',
        body: JSON.stringify({ userId, amount, reason }),
      });
      setMessage('Repasse enviado com sucesso para usuário.');
      setAmount(0);
      setReason('');
      await load();
    } catch (error) {
      setMessage((error as Error).message);
    }
  }

  return (
    <section className="card">
      <h2>Painel do Corretor Virtual</h2>
      {message && <p>{message}</p>}

      <p><strong>Saldo disponível:</strong> {data?.available ?? 0} moedas virtuais</p>
      <p><strong>Total recebido:</strong> {data?.receivedTotal ?? 0} moedas virtuais</p>

      <h3>Repassar moeda virtual para usuário</h3>
      <form onSubmit={handleTransfer}>
        <select value={userId} onChange={(event) => setUserId(event.target.value)} required>
          <option value="">Selecione o usuário</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>{user.name} ({user.email})</option>
          ))}
        </select>
        <input type="number" step="0.01" min="0.01" placeholder="Quantidade" value={amount} onChange={(event) => setAmount(Number(event.target.value))} required />
        <input placeholder="Motivo obrigatório" value={reason} onChange={(event) => setReason(event.target.value)} required />
        <button type="submit">Enviar repasse</button>
      </form>

      <h3>Histórico básico de repasses</h3>
      <ul>
        {data?.history?.map((item) => (
          <li key={item.id}>
            [{item.type}] {item.amount} moedas - {item.reason}
          </li>
        ))}
      </ul>
    </section>
  );
}
