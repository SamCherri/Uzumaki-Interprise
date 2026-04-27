import { FormEvent, useEffect, useState } from 'react';
import { api } from '../services/api';

type BrokerBalance = { available: string; receivedTotal: string };
type BrokerHistory = { transfers: Array<{ id: string; type: string; amount: string; reason: string; createdAt: string }> };

export function BrokerDashboard() {
  const [balance, setBalance] = useState<BrokerBalance | null>(null);
  const [history, setHistory] = useState<BrokerHistory | null>(null);
  const [error, setError] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');

  async function load() {
    try {
      const [balanceResponse, historyResponse] = await Promise.all([api<BrokerBalance>('/broker/balance'), api<BrokerHistory>('/broker/history')]);
      setBalance(balanceResponse);
      setHistory(historyResponse);
      setError('');
    } catch (err) {
      setError((err as Error).message);
    }
  }

  useEffect(() => { load(); }, []);

  async function submitTransfer(event: FormEvent) {
    event.preventDefault();
    try {
      await api('/broker/transfer-to-user', { method: 'POST', body: JSON.stringify({ userEmail, amount, reason }) });
      setUserEmail('');
      setAmount('');
      setReason('');
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <section className="card">
      <h2>🤝 Painel Corretor</h2>
      {error && <p className="status-message error">{error}</p>}

      {balance && (
        <div className="summary-grid">
          <div className="summary-item"><span className="summary-label">Saldo disponível</span><strong className="summary-value">{balance.available}</strong></div>
          <div className="summary-item"><span className="summary-label">Total recebido</span><strong className="summary-value">{balance.receivedTotal}</strong></div>
        </div>
      )}

      <h3 className="nested-card">Repassar moeda para usuário</h3>
      <form onSubmit={submitTransfer} className="form-grid">
        <input value={userEmail} onChange={(e) => setUserEmail(e.target.value)} placeholder="E-mail do usuário" type="email" required />
        <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Quantidade" required />
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motivo" required />
        <button className="button-primary" type="submit">Enviar ao usuário</button>
      </form>

      <h3 className="nested-card">Histórico de repasses</h3>
      {history?.transfers.length === 0 && <p className="empty-state">Sem repasses registrados.</p>}
      <div className="mobile-card-list">
        {history?.transfers.slice(0, 8).map((item) => (
          <article key={item.id} className="summary-item compact-card">
            <p><strong>{item.type}</strong></p>
            <p>Valor: {item.amount}</p>
            <p>Motivo: {item.reason}</p>
            <p>{new Date(item.createdAt).toLocaleString('pt-BR')}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
