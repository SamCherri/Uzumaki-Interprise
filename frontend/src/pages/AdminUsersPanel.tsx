import { FormEvent, useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';
import { ConfirmActionModal } from '../components/ConfirmActionModal';
import { translateRole } from '../utils/labels';

type UserRow = {
  id: string;
  name: string;
  email: string;
  characterName?: string | null;
  bankAccountNumber?: string | null;
  roles: string[];
  isBlocked: boolean;
  wallet: {
    availableBalance: string | number;
    lockedBalance: string | number;
    pendingWithdrawalBalance: string | number;
  };
  createdAt: string;
};

const ALL_ROLES = ['USER', 'VIRTUAL_BROKER', 'BUSINESS_OWNER', 'AUDITOR', 'ADMIN', 'COIN_CHIEF_ADMIN', 'SUPER_ADMIN'];

type AdminUsersPanelProps = {
  onPermissionsUpdated: () => Promise<void>;
  mode?: 'users' | 'brokers';
};

function getCurrentUserIdFromToken(): string | null {
  const token = localStorage.getItem('token');
  if (!token) return null;

  try {
    const payload = token.split('.')[1] ?? "";
    const padded = payload.padEnd(Math.ceil(payload.length / 4) * 4, "=");
    const parsed = JSON.parse(atob(padded)) as { sub?: unknown };
    return typeof parsed.sub === "string" ? parsed.sub : null;
  } catch {
    return null;
  }
}

export function AdminUsersPanel({ onPermissionsUpdated, mode = 'users' }: AdminUsersPanelProps) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingRoles, setEditingRoles] = useState<string[]>(['USER']);
  const [blockTarget, setBlockTarget] = useState<{userId:string; mode:'block'|'unblock'}|null>(null);
  const [blockReason, setBlockReason] = useState('');
  const [blockConfirm, setBlockConfirm] = useState('');
  const [blockLoading, setBlockLoading] = useState(false);

  async function loadUsers() {
    setLoading(true);
    try {
      const query = search ? `?search=${encodeURIComponent(search)}` : '';
      const data = await api<{ users: UserRow[] }>(`/admin/users${query}`);
      setUsers(data.users);
      setError('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const brokers = useMemo(() => users.filter((user) => user.roles.includes('VIRTUAL_BROKER')), [users]);

  function toggleRole(role: string) {
    setEditingRoles((prev) => {
      if (role === 'USER') return prev;
      return prev.includes(role) ? prev.filter((item) => item !== role) : [...prev, role];
    });
  }

  function startEditingRoles(user: UserRow) {
    setEditingUserId(user.id);
    setEditingRoles(Array.from(new Set(['USER', ...user.roles])));
    setSuccess('');
  }

  async function saveRoles(event: FormEvent) {
    event.preventDefault();
    if (!editingUserId) return;

    await api(`/admin/users/${editingUserId}/roles`, {
      method: 'PATCH',
      body: JSON.stringify({ roles: Array.from(new Set(['USER', ...editingRoles])) }),
    });

    const currentUserId = getCurrentUserIdFromToken();
    if (currentUserId && editingUserId === currentUserId) {
      await onPermissionsUpdated();
      setSuccess('Suas permissões foram alteradas. Recarregue a página para atualizar o menu.');
    } else {
      setSuccess('Permissões atualizadas com sucesso. Alterações são registradas em auditoria.');
    }

    setEditingUserId(null);
    await loadUsers();
  }

  async function confirmBlockAction() {
    if (!blockTarget || !blockReason.trim()) return;
    setBlockLoading(true);
    try {
      await api(`/admin/users/${blockTarget.userId}/${blockTarget.mode}`, { method: 'PATCH', body: JSON.stringify({ reason: blockReason.trim() }) });
      setBlockTarget(null); setBlockReason(''); setBlockConfirm('');
      await loadUsers();
    } finally { setBlockLoading(false); }
  }

  async function removeBrokerRole(user: UserRow) {
    const nextRoles = user.roles.filter((role) => role !== 'VIRTUAL_BROKER');
    await api(`/admin/users/${user.id}/roles`, {
      method: 'PATCH',
      body: JSON.stringify({ roles: Array.from(new Set(['USER', ...nextRoles])) }),
    });
    await loadUsers();
  }

  return (
    <section className="nested-card">
      <h3>{mode === 'brokers' ? 'Corretores autorizados' : 'Usuários'}</h3>
      <p className="info-text">{mode === 'brokers' ? 'Usuários com permissão de corretor virtual.' : 'Alterações de permissões são registradas em auditoria.'}</p>

      <form
        className="form-grid"
        onSubmit={(event) => {
          event.preventDefault();
          loadUsers();
        }}
      >
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={mode === 'brokers' ? 'Buscar por conta RP/personagem/nome/e-mail' : 'Buscar por conta RP/personagem/nome/e-mail'} />
        <button className="button-primary" type="submit">{mode === 'brokers' ? 'Buscar corretores' : 'Buscar usuários'}</button>
      </form>

      {error && <p className="status-message error">{error}</p>}
      {success && <p className="status-message success">{success}</p>}
      {loading && <p className="info-text">Carregando usuários...</p>}

      {mode === 'users' && (
        <div className="mobile-card-list">
          {users.map((user) => (
          <article key={user.id} className="summary-item compact-card">
            <strong>Usuário: {user.name}</strong>
            <p>Personagem: {user.characterName ?? 'Sem personagem'}</p>
            <p>Conta RP: {user.bankAccountNumber ?? 'Sem conta RP'}</p>
            <p className="info-text">Email técnico: {user.email}</p>
            <p>Status: {user.isBlocked ? 'Bloqueado' : 'Ativo'}</p>
            <p>Cargos: {user.roles.map((role) => translateRole(role)).join(', ')}</p>
            <p>Disponível: {user.wallet.availableBalance}</p>
            <p>Bloqueado: {user.wallet.lockedBalance}</p>
            <p>Pendente saque: {user.wallet.pendingWithdrawalBalance}</p>
            <div className="action-grid">
              <button type="button" className="button-primary" onClick={() => startEditingRoles(user)}>Editar permissões</button>
              {user.isBlocked ? (
                <button type="button" className="button-success" onClick={() => setBlockTarget({ userId: user.id, mode: 'unblock' })}>Desbloquear</button>
              ) : (
                <button type="button" className="button-danger" onClick={() => setBlockTarget({ userId: user.id, mode: 'block' })}>Bloquear</button>
              )}
            </div>

            {editingUserId === user.id && (
              <form className="nested-card" onSubmit={saveRoles}>
                {ALL_ROLES.map((role) => (
                  <label key={role} className="role-checkbox-label">
                    <input
                      type="checkbox"
                      checked={editingRoles.includes(role)}
                      disabled={role === 'USER'}
                      onChange={() => toggleRole(role)}
                    />
                    {translateRole(role)}
                  </label>
                ))}
                <button className="button-primary" type="submit">Salvar permissões</button>
              </form>
            )}
          </article>
          ))}
        </div>
      )}

      {mode === 'users' && <h3 className="nested-card">Corretores</h3>}
      <div className="mobile-card-list">
        {brokers.map((broker) => (
          <article key={broker.id} className="summary-item compact-card">
            <strong>Usuário: {broker.name}</strong>
            <p>Personagem: {broker.characterName ?? 'Sem personagem'}</p>
            <p>Conta RP: {broker.bankAccountNumber ?? 'Sem conta RP'}</p>
            <p className="info-text">Email técnico: {broker.email}</p>
            <p>Saldo RPC: {broker.wallet.availableBalance}</p>
            <button className="button-danger" onClick={() => removeBrokerRole(broker)}>
              Remover função de corretor
            </button>
          </article>
        ))}
        {brokers.length === 0 && <p className="empty-state">Nenhum corretor encontrado.</p>}
      </div>
      <ConfirmActionModal
        open={Boolean(blockTarget)}
        title={blockTarget?.mode === 'block' ? 'Confirmar bloqueio de usuário' : 'Confirmar desbloqueio de usuário'}
        description="Essa ação altera o acesso do usuário e será auditada."
        danger={blockTarget?.mode === 'block'}
        requireConfirmText={blockTarget?.mode === 'block' ? 'CONFIRMAR' : undefined}
        confirmTextValue={blockConfirm}
        isLoading={blockLoading}
        onCancel={() => { if (blockLoading) return; setBlockTarget(null); setBlockReason(''); setBlockConfirm(''); }}
        onConfirm={confirmBlockAction}
        extraFields={<><input value={blockReason} onChange={(e)=>setBlockReason(e.target.value)} placeholder="Motivo" />{blockTarget?.mode === 'block' && <input value={blockConfirm} onChange={(e)=>setBlockConfirm(e.target.value)} placeholder="Digite CONFIRMAR" />}</>}
      />
    </section>
  );
}
