import { useEffect, useState } from 'react';
import { api } from '../services/api';
import {
  translateAdminAction,
  translateBoostSource,
  translateCompanyStatus,
  translateOrderMode,
  translateOrderStatus,
  translateOrderType,
  translateRole,
  translateTransferType,
  translateWithdrawalStatus,
} from '../utils/labels';

type Tab = 'logs' | 'transactions' | 'transfers' | 'withdrawals' | 'orders' | 'trades';

function formatAuditItem(item: any) {
  return {
    ...item,
    action: translateAdminAction(item?.action),
    status:
      tabStatus(item?.status) ??
      item?.status,
    type: tabType(item?.type) ?? item?.type,
    mode: translateOrderMode(item?.mode),
    role: translateRole(item?.role),
    roles: Array.isArray(item?.roles) ? item.roles.map((role: string) => translateRole(role)) : item?.roles,
    source: translateBoostSource(item?.source),
    transferType: translateTransferType(item?.transferType),
  };
}

function tabStatus(status?: string) {
  if (!status) return '-';
  return translateWithdrawalStatus(status) !== status
    ? translateWithdrawalStatus(status)
    : translateOrderStatus(status) !== status
      ? translateOrderStatus(status)
      : translateCompanyStatus(status);
}

function tabType(type?: string) {
  if (!type) return '-';
  return translateOrderType(type) !== type ? translateOrderType(type) : translateTransferType(type);
}

export function AdminAuditPanel() {
  const [tab, setTab] = useState<Tab>('logs');
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => { void load(); }, [tab]);

  async function load() {
    const path = `/admin/audit/${tab}?page=1&pageSize=20${search ? `&search=${encodeURIComponent(search)}` : ''}`;
    const result = await api<{ items: any[] }>(path);
    setItems(result.items ?? []);
  }

  return <div className="nested-card">
    <h3>Auditoria</h3>
    <nav className="pill-nav">
      {(['logs','transactions','transfers','withdrawals','orders','trades'] as Tab[]).map((name) => <button key={name} className={tab===name?'pill active':'pill'} onClick={()=>setTab(name)}>{name}</button>)}
    </nav>
    <div className="form-grid">
      <input placeholder="Buscar" value={search} onChange={(e) => setSearch(e.target.value)} />
      <button className="button-primary" onClick={() => load()}>Filtrar</button>
    </div>
    <div className="mobile-card-list">
      {items.map((item) => <article className="summary-item compact-card" key={item.id}><pre>{JSON.stringify(formatAuditItem(item), null, 2)}</pre></article>)}
      {items.length===0 && <p className="empty-state">Sem dados.</p>}
    </div>
  </div>;
}
