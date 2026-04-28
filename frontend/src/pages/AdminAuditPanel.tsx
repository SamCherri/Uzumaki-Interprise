import { useEffect, useState } from 'react';
import { api } from '../services/api';

type Tab = 'logs' | 'transactions' | 'transfers' | 'withdrawals' | 'orders' | 'trades';

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
      {items.map((item) => <article className="summary-item compact-card" key={item.id}><pre>{JSON.stringify(item, null, 2)}</pre></article>)}
      {items.length===0 && <p className="empty-state">Sem dados.</p>}
    </div>
  </div>;
}
