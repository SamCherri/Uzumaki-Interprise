import { FormEvent, useEffect, useState } from 'react';
import { api } from '../services/api';
import { translateWithdrawalStatus } from '../utils/labels';

type HoldingsResponse = {
  wallet: {
    fiatAvailableBalance: string;
    fiatPendingWithdrawalBalance: string;
    rpcAvailableBalance: string;
    rpcLockedBalance: string;
  };
};

type Withdrawal = {
  id: string;
  code: string;
  amount: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'REJECTED' | 'CANCELED';
  userNote?: string | null;
  adminNote?: string | null;
  createdAt: string;
};

function moeda(value: number) {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function WithdrawalsPage() {
  const [wallet, setWallet] = useState<HoldingsResponse['wallet'] | null>(null);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [amount, setAmount] = useState('');
  const [userNote, setUserNote] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function load() {
    try {
      const [walletResponse, withdrawalResponse] = await Promise.all([
        api<HoldingsResponse>('/me/holdings'),
        api<{ withdrawals: Withdrawal[] }>('/withdrawals/me'),
      ]);

      setWallet(walletResponse.wallet);
      setWithdrawals(withdrawalResponse.withdrawals);
      setError('');
    } catch (err) {
      setError((err as Error).message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      const created = await api<Withdrawal>('/withdrawals', {
        method: 'POST',
        body: JSON.stringify({ amount, userNote }),
      });
      setMessage(`Saque solicitado com sucesso. Código: ${created.code}`);
      setAmount('');
      setUserNote('');
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function cancel(id: string) {
    try {
      await api(`/withdrawals/${id}/cancel`, { method: 'POST' });
      setMessage('Saque cancelado e valor devolvido ao saldo disponível.');
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <section className="card">
      <h2>🏧 Sacar R$</h2>
      <p className="info-text">Seu saldo para saque é em R$. Para transformar RPC em R$, venda RPC no mercado RPC/R$.</p>
      {error && <p className="status-message error">{error}</p>}
      {message && <p className="status-message">{message}</p>}

      {wallet && (
        <div className="summary-grid nested-card">
          <div className="summary-item"><span className="summary-label">Saldo disponível R$</span><strong className="summary-value">{moeda(Number(wallet.fiatAvailableBalance))}</strong></div>
          <div className="summary-item"><span className="summary-label">Pendente de saque R$</span><strong className="summary-value">{moeda(Number(wallet.fiatPendingWithdrawalBalance))}</strong></div>
          <div className="summary-item"><span className="summary-label">Saldo RPC disponível</span><strong className="summary-value">{moeda(Number(wallet.rpcAvailableBalance))}</strong></div>
        </div>
      )}

      <form onSubmit={submit} className="form-grid nested-card">
        <input value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Valor em R$" required />
        <input value={userNote} onChange={(event) => setUserNote(event.target.value)} placeholder="Observação" />
        <p className="info-text">O valor solicitado ficará pendente até o ADM concluir a entrega dentro do RP.</p>
        <button className="button-primary" type="submit">Solicitar saque</button>
      </form>

      <h3 className="nested-card">Meus saques</h3>
      <div className="mobile-card-list">
        {withdrawals.length === 0 && <p className="empty-state">Nenhum saque solicitado até agora.</p>}
        {withdrawals.map((item) => (
          <article key={item.id} className="summary-item compact-card">
            <p><strong>Código:</strong> {item.code}</p>
            <p><strong>Valor:</strong> {moeda(Number(item.amount))} R$</p>
            <p><strong>Status:</strong> {translateWithdrawalStatus(item.status)}</p>
            <p><strong>Data:</strong> {new Date(item.createdAt).toLocaleString('pt-BR')}</p>
            <p><strong>Observação:</strong> {item.userNote || 'Sem observação'}</p>
            {item.status === 'PENDING' && (
              <button className="button-danger" type="button" onClick={() => cancel(item.id)}>
                Cancelar
              </button>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
