import { useState } from 'react';
import { api } from '../services/api';

export function AdminReportsPanel() {
  const [userId, setUserId] = useState('');
  const [brokerId, setBrokerId] = useState('');
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');

  async function loadUser() { try { setData(await api(`/admin/reports/users/${userId}`)); setError(''); } catch (e) { setError((e as Error).message); } }
  async function loadBroker() { try { setData(await api(`/admin/reports/brokers/${brokerId}`)); setError(''); } catch (e) { setError((e as Error).message); } }
  function download(path: string, name: string) { const url = `${import.meta.env.VITE_API_URL ?? 'http://localhost:3333/api'}${path}`; const a=document.createElement('a'); a.href=url; a.download=name; a.click(); }

  return <section className="card nested-card"><h3>Relatórios Admin</h3>
    <label>ID do usuário<input value={userId} onChange={(e)=>setUserId(e.target.value)} /></label>
    <div className="actions-row"><button className="button-primary" onClick={loadUser}>Gerar relatório de usuário</button><button className="button-secondary" onClick={()=>download(`/admin/reports/users/${userId}.csv`,'user-report.csv')}>Baixar CSV do usuário</button></div>
    <label>ID do corretor<input value={brokerId} onChange={(e)=>setBrokerId(e.target.value)} /></label>
    <div className="actions-row"><button className="button-primary" onClick={loadBroker}>Gerar relatório de corretor</button><button className="button-secondary" onClick={()=>download(`/admin/reports/brokers/${brokerId}.csv`,'broker-report.csv')}>Baixar CSV do corretor</button></div>
    <button className="button-secondary" onClick={()=>download('/admin/reports/admin-logs.csv','admin-logs.csv')}>Baixar logs admin CSV</button>
    {error && <p className="error-text">{error}</p>}
    {data && <pre style={{whiteSpace:'pre-wrap'}}>{JSON.stringify(data,null,2)}</pre>}
  </section>;
}
