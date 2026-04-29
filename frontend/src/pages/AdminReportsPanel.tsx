import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { translateCompanyStatus } from '../utils/labels';

export function AdminReportsPanel() {
  const [overview, setOverview] = useState<any>(null);
  const [revenues, setRevenues] = useState<any[]>([]);

  useEffect(() => { void load(); }, []);
  async function load() {
    const [ov, rev] = await Promise.all([
      api('/admin/reports/overview'),
      api<{items:any[]}>('/admin/reports/company-revenues'),
    ]);
    setOverview(ov);
    setRevenues(rev.items ?? []);
  }

  return <div className="nested-card">
    <h3>Relatórios</h3>
    {overview && <div className="summary-grid">{Object.entries(overview).map(([k,v]) => <div key={k} className="summary-item"><span className="summary-label">{k}</span><strong className="summary-value">{String(v)}</strong></div>)}</div>}
    <h4>Receitas por projeto</h4>
    <div className="mobile-card-list">{revenues.map((item)=> <article className="summary-item compact-card" key={item.companyId}><strong>{item.ticker} - {item.token}</strong><p>Dono: {item.owner?.name ?? '-'}</p><p>Saldo: {String(item.balance)}</p><p>Taxas: {String(item.totalReceivedFees)}</p><p>Status: {translateCompanyStatus(item.status)}</p></article>)}</div>
  </div>;
}
