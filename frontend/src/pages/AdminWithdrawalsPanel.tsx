import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { translateWithdrawalStatus } from '../utils/labels';

type Withdrawal = {
  id: string;
  code: string;
  amount: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'REJECTED' | 'CANCELED';
  userNote?: string | null;
  createdAt: string;
  user: {
    name: string;
    email: string;
  };
};

export function AdminWithdrawalsPanel() {
  const [items, setItems] = useState<Withdrawal[]>([]);
  const [error, setError] = useState('');

  async function load() {
    try {
      const response = await api<{ withdrawals: Withdrawal[] }>('/admin/withdrawals');
      setItems(response.withdrawals);
      setError('');
    } catch (err) {
      setError((err as Error).message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function action(id: string, endpoint: 'mark-processing' | 'complete' | 'reject') {
    const adminNote = window.prompt('Observação do ADM (opcional):') ?? '';
    await api(`/admin/withdrawals/${id}/${endpoint}`, {
      method: 'POST',
      body: JSON.stringify({ adminNote }),
    });
    await load();
  }

  return (
    <section className="nested-card">
      <h3>🏧 Saques</h3>
      {error && <p className="status-message error">{error}</p>}
      {items.length === 0 && <p className="empty-state">Nenhum pedido de saque encontrado.</p>}
      <div className="mobile-card-list">
        {items.map((item) => (
          <article key={item.id} className="summary-item compact-card">
            <p><strong>Código:</strong> {item.code}</p>
            <p><strong>Usuário:</strong> {item.user.name}</p>
            <p><strong>E-mail:</strong> {item.user.email}</p>
            <p><strong>Valor:</strong> {item.amount} RPC</p>
            <p><strong>Status:</strong> {translateWithdrawalStatus(item.status)}</p>
            <p><strong>Observação do usuário:</strong> {item.userNote || 'Sem observação'}</p>
            <p><strong>Data:</strong> {new Date(item.createdAt).toLocaleString('pt-BR')}</p>

            {['COMPLETED', 'REJECTED', 'CANCELED'].includes(item.status) ? null : (
              <div className="action-grid">
                {item.status === 'PENDING' && (
                  <button className="button-primary" type="button" onClick={() => action(item.id, 'mark-processing')}>
                    Marcar em processamento
                  </button>
                )}
                <button className="button-success" type="button" onClick={() => action(item.id, 'complete')}>
                  Concluir saque
                </button>
                <button className="button-danger" type="button" onClick={() => action(item.id, 'reject')}>
                  Rejeitar
                </button>
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
