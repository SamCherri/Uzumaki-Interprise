import { useEffect, useState } from 'react';
import { ConfirmActionModal } from '../components/ConfirmActionModal';
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
    characterName?: string | null;
    bankAccountNumber?: string | null;
  };
};

export function AdminWithdrawalsPanel() {
  const [items, setItems] = useState<Withdrawal[]>([]);
  const [error, setError] = useState('');
  const [pending, setPending] = useState<{id:string; endpoint:'mark-processing'|'complete'|'reject'} | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  async function runAction() {
    if (!pending) return;
    setIsSubmitting(true);
    try {
      await api(`/admin/withdrawals/${pending.id}/${pending.endpoint}`, { method: 'POST', body: JSON.stringify({ adminNote }) });
      setPending(null);
      setAdminNote('');
      setConfirmText('');
      await load();
    } finally { setIsSubmitting(false); }
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
            <p><strong>Dados do jogador:</strong></p>
            <p><strong>Usuário:</strong> {item.user.name}</p>
            <p><strong>Personagem:</strong> {item.user.characterName ?? 'Sem personagem'}</p>
            <p><strong>Conta RP:</strong> {item.user.bankAccountNumber ?? 'Sem conta RP'}</p>
            <p><strong>Email técnico:</strong> {item.user.email}</p>
            <p><strong>Valor:</strong> {item.amount} RPC</p>
            <p><strong>Status:</strong> {translateWithdrawalStatus(item.status)}</p>
            <p><strong>Observação do usuário:</strong> {item.userNote || 'Sem observação'}</p>
            <p><strong>Data:</strong> {new Date(item.createdAt).toLocaleString('pt-BR')}</p>

            {['COMPLETED', 'REJECTED', 'CANCELED'].includes(item.status) ? null : (
              <div className="action-grid">
                {item.status === 'PENDING' && (
                  <button className="button-primary" type="button" onClick={() => setPending({ id: item.id, endpoint: 'mark-processing' })}>
                    Marcar em processamento
                  </button>
                )}
                <button className="button-success" type="button" onClick={() => setPending({ id: item.id, endpoint: 'complete' })}>
                  Concluir saque
                </button>
                <button className="button-danger" type="button" onClick={() => setPending({ id: item.id, endpoint: 'reject' })}>
                  Rejeitar
                </button>
              </div>
            )}
          </article>
        ))}
      </div>
      <ConfirmActionModal
        open={Boolean(pending)}
        title="Confirmar ação em saque"
        description="Essa ação altera o estado do saque e será registrada na auditoria administrativa."
        danger={pending?.endpoint === 'complete' || pending?.endpoint === 'reject'}
        requireConfirmText={pending?.endpoint === 'complete' || pending?.endpoint === 'reject' ? 'CONFIRMAR' : undefined}
        confirmTextValue={confirmText}
        isLoading={isSubmitting}
        onCancel={() => { if (isSubmitting) return; setPending(null); setAdminNote(''); setConfirmText(''); }}
        onConfirm={runAction}
        extraFields={<><input value={adminNote} onChange={(e)=>setAdminNote(e.target.value)} placeholder="Observação do ADM (opcional)" />{(pending?.endpoint === 'complete' || pending?.endpoint === 'reject') && <input value={confirmText} onChange={(e)=>setConfirmText(e.target.value)} placeholder="Digite CONFIRMAR" />}</>}
      />
    </section>
  );
}
