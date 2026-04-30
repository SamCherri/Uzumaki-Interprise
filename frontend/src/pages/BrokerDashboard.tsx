import { FormEvent, useMemo, useEffect, useState } from 'react';
import { api } from '../services/api';
import { translateTransferType } from '../utils/labels';

type BrokerBalance = { available: string; receivedTotal: string };
type BrokerHistory = { transfers: Array<{ id: string; type: string; amount: string; reason: string; createdAt: string }> };

export function BrokerDashboard() {
  const [balance, setBalance] = useState<BrokerBalance | null>(null);
  const [history, setHistory] = useState<BrokerHistory | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');

  async function load() {
    try {
      const [balanceResponse, historyResponse] = await Promise.all([api<BrokerBalance>('/broker/balance'), api<BrokerHistory>('/broker/history')]);
      setBalance(balanceResponse);
      setHistory(historyResponse);
      setError('');
      setMessage('');
    } catch (err) {
      setError((err as Error).message);
    }
  }

  useEffect(() => { load(); }, []);


  const transfers = history?.transfers ?? [];
  const totalTransfers = transfers.length;
  const servedUsers = useMemo(() => {
    const unique = new Set(
      transfers
        .map((item) => item.reason?.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]?.toLowerCase())
        .filter((value): value is string => Boolean(value))
    );
    return unique.size;
  }, [transfers]);

  async function submitTransfer(event: FormEvent) {
    event.preventDefault();
    setError('');
    setMessage('');
    setIsSubmitting(true);

    try {
      await api('/broker/transfer-to-user', { method: 'POST', body: JSON.stringify({ userEmail, amount, reason }) });
      setUserEmail('');
      setAmount('');
      setReason('');
      await load();
      setMessage('RPC enviado ao usuário com sucesso.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="card">
      <h2>🤝 Painel Corretor</h2>
      {error && <p className="status-message error">{error}</p>}
      {message && <p className="status-message success">{message}</p>}

      {balance && (
        <div className="summary-grid">
          <div className="summary-item"><span className="summary-label">Saldo RPC</span><strong className="summary-value">{balance.available}</strong></div>
          <div className="summary-item"><span className="summary-label">Total RPC recebido</span><strong className="summary-value">{balance.receivedTotal}</strong></div>
          <div className="summary-item"><span className="summary-label">Usuários atendidos</span><strong className="summary-value">{servedUsers}</strong></div>
          <div className="summary-item"><span className="summary-label">Total de envios</span><strong className="summary-value">{totalTransfers}</strong></div>
        </div>
      )}

      <h3 className="nested-card">Enviar RPC para usuário</h3>
      <p className="info-text">Use após vender RPC ao jogador dentro do RP.</p>
      <p className="info-text">Limites não configurados.</p>
      <form onSubmit={submitTransfer} className="form-grid">
        <input value={userEmail} onChange={(e) => setUserEmail(e.target.value)} placeholder="E-mail do usuário" type="email" required />
        <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Quantidade RPC" required />
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Observação" required />
        <button className="button-primary" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Processando...' : 'Enviar RPC ao usuário'}</button>
      </form>

      <h3 className="nested-card">Histórico de envios</h3>
      {transfers.length === 0 && <p className="empty-state">Sem envios registrados.</p>}
      <div className="mobile-card-list">
        {transfers.slice(0, 8).map((item) => (
          <article key={item.id} className="summary-item compact-card">
            <p><strong>{translateTransferType(item.type)}</strong></p>
            <p>RPC: {item.amount}</p>
            <p>Motivo: {item.reason}</p>
            <p>{new Date(item.createdAt).toLocaleString('pt-BR')}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
