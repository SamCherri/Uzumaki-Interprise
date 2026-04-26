import { FormEvent, useEffect, useState } from 'react';
import { api } from '../services/api';

type BrokerBalance = {
  available: string;
  receivedTotal: string;
};

type BrokerHistory = {
  transfers: Array<{ id: string; type: string; amount: string; reason: string; createdAt: string }>;
};

export function BrokerDashboard() {
  const [balance, setBalance] = useState<BrokerBalance | null>(null);
  const [history, setHistory] = useState<BrokerHistory | null>(null);
  const [error, setError] = useState('');

  const [userId, setUserId] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');

  async function load() {
    try {
      const [balanceResponse, historyResponse] = await Promise.all([
        api<BrokerBalance>('/broker/balance'),
        api<BrokerHistory>('/broker/history'),
      ]);
      setBalance(balanceResponse);
      setHistory(historyResponse);
      setError('');
    } catch (err) {
      setError((err as Error).message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function submitTransfer(event: FormEvent) {
    event.preventDefault();
    try {
      await api('/broker/transfer-to-user', {
        method: 'POST',
        body: JSON.stringify({ userId, amount, reason }),
      });
      setUserId('');
      setAmount('');
      setReason('');
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <section className="card">
      <h2>Painel do Corretor Virtual</h2>
      {error && <p>{error}</p>}

      {balance && (
        <div>
          <p><strong>Saldo disponível do corretor:</strong> {balance.available}</p>
          <p><strong>Total recebido da tesouraria:</strong> {balance.receivedTotal}</p>
        </div>
      )}

      <h3>Repassar moeda para usuário</h3>
      <form onSubmit={submitTransfer} className="form-grid">
        <input value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="ID do usuário" required />
        <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Quantidade" required />
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motivo" required />
        <button type="submit">Enviar ao usuário</button>
      </form>

      {history && (
        <>
          <h3>Histórico básico de repasses</h3>
          <ul>
            {history.transfers.slice(0, 8).map((item) => (
              <li key={item.id}>{item.type} - {item.amount} - {item.reason} ({new Date(item.createdAt).toLocaleString()})</li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
