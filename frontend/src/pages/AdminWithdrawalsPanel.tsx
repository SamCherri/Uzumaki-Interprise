import { useEffect, useState } from 'react';
import { ConfirmActionModal } from '../components/ConfirmActionModal';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
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
  const [modalAction, setModalAction] = useState<{ id: string; endpoint: 'mark-processing' | 'complete' | 'reject' } | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [confirmTextValue, setConfirmTextValue] = useState('');
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

  function openActionModal(id: string, endpoint: 'mark-processing' | 'complete' | 'reject') {
    setModalAction({ id, endpoint });
    setAdminNote('');
    setConfirmTextValue('');
  }

  function closeActionModal() {
    if (isSubmitting) return;
    setModalAction(null);
    setAdminNote('');
    setConfirmTextValue('');
  }

  async function confirmAction() {
    if (!modalAction) return;
    setIsSubmitting(true);
    setError('');
    try {
      await api(`/admin/withdrawals/${modalAction.id}/${modalAction.endpoint}`, {
        method: 'POST',
        body: JSON.stringify({ adminNote: adminNote.trim() }),
      });
      closeActionModal();
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
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
            <p><strong>Status:</strong> <Badge variant={item.status === 'COMPLETED' ? 'success' : item.status === 'REJECTED' || item.status === 'CANCELED' ? 'danger' : item.status === 'PROCESSING' ? 'warning' : 'info'}>{translateWithdrawalStatus(item.status)}</Badge></p>
            <p><strong>Observação do usuário:</strong> {item.userNote || 'Sem observação'}</p>
            <p><strong>Data:</strong> {new Date(item.createdAt).toLocaleString('pt-BR')}</p>

            {['COMPLETED', 'REJECTED', 'CANCELED'].includes(item.status) ? null : (
              <div className="action-grid">
                {item.status === 'PENDING' && (
                  <Button variant="secondary" onClick={() => openActionModal(item.id, 'mark-processing')} disabled={isSubmitting}>
                    Marcar em processamento
                  </Button>
                )}
                <Button variant="success" onClick={() => openActionModal(item.id, 'complete')} disabled={isSubmitting}>
                  Concluir saque
                </Button>
                <Button variant="danger" onClick={() => openActionModal(item.id, 'reject')} disabled={isSubmitting}>
                  Rejeitar
                </Button>
              </div>
            )}
          </article>
        ))}
      </div>
      <ConfirmActionModal
        open={Boolean(modalAction)}
        title={modalAction?.endpoint === 'complete' ? 'Concluir saque' : modalAction?.endpoint === 'reject' ? 'Rejeitar saque' : 'Marcar saque em processamento'}
        description={modalAction?.endpoint === 'complete' ? 'Esta ação conclui o saque e não deve ser usada sem conferência.' : modalAction?.endpoint === 'reject' ? 'Esta ação rejeita o saque do usuário.' : 'Atualiza o status do saque para processamento.'}
        danger={modalAction?.endpoint !== 'mark-processing'}
        requireConfirmText={modalAction?.endpoint === 'mark-processing' ? undefined : 'CONFIRMAR'}
        confirmTextValue={confirmTextValue}
        isLoading={isSubmitting}
        confirmLabel={modalAction?.endpoint === 'complete' ? 'Concluir saque' : modalAction?.endpoint === 'reject' ? 'Rejeitar saque' : 'Marcar em processamento'}
        onCancel={closeActionModal}
        onConfirm={confirmAction}
        extraFields={<>
          <label className="admin-modal-field">
            <span>Observação do ADM (opcional)</span>
            <textarea value={adminNote} onChange={(event) => setAdminNote(event.target.value)} disabled={isSubmitting} placeholder="Adicione um contexto para auditoria" />
          </label>
          {modalAction?.endpoint !== 'mark-processing' && (
            <label className="admin-modal-field">
              <span>Confirmação *</span>
              <input type="text" value={confirmTextValue} onChange={(event) => setConfirmTextValue(event.target.value)} placeholder="Digite CONFIRMAR" disabled={isSubmitting} required />
            </label>
          )}
        </>}
      />
    </section>
  );
}
