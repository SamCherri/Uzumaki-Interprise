import { useState } from 'react';
import { api } from '../services/api';

type UserReport = { user: { id: string; email: string }; wallet: Record<string, unknown>; activity: Record<string, unknown> };
type BrokerReport = { broker: { id: string; email: string } };

export function AdminReportsPanel() {
  const [userId, setUserId] = useState('');
  const [brokerId, setBrokerId] = useState('');
  const [data, setData] = useState<UserReport | BrokerReport | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function loadUser() {
    if (!userId.trim()) return setError('Informe o ID do usuário.');
    try { setLoading(true); setData(await api<UserReport>(`/admin/reports/users/${userId.trim()}`)); setError(''); }
    catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }

  async function loadBroker() {
    if (!brokerId.trim()) return setError('Informe o ID do corretor.');
    try { setLoading(true); setData(await api<BrokerReport>(`/admin/reports/brokers/${brokerId.trim()}`)); setError(''); }
    catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }

  async function download(path: string, filename: string) {
    try {
      setLoading(true);
      const base = import.meta.env.VITE_API_URL ?? 'http://localhost:3333/api';
      const token = localStorage.getItem('token');
      const res = await fetch(`${base}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok) throw new Error('Falha ao baixar arquivo.');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      setError('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return <section className="card nested-card"><h3>Relatórios Admin</h3>
    <label>ID do usuário<input value={userId} onChange={(e) => setUserId(e.target.value)} /></label>
    <div className="actions-row"><button className="button-primary" onClick={loadUser} disabled={loading}>Gerar relatório de usuário</button><button className="button-secondary" onClick={() => userId.trim() ? download(`/admin/reports/users/${userId.trim()}.csv`, 'user-report.csv') : setError('Informe o ID do usuário.')} disabled={loading}>Baixar CSV do usuário</button></div>
    <label>ID do corretor<input value={brokerId} onChange={(e) => setBrokerId(e.target.value)} /></label>
    <div className="actions-row"><button className="button-primary" onClick={loadBroker} disabled={loading}>Gerar relatório de corretor</button><button className="button-secondary" onClick={() => brokerId.trim() ? download(`/admin/reports/brokers/${brokerId.trim()}.csv`, 'broker-report.csv') : setError('Informe o ID do corretor.')} disabled={loading}>Baixar CSV do corretor</button></div>
    <button className="button-secondary" onClick={() => download('/admin/reports/admin-logs.csv', 'admin-logs.csv')} disabled={loading}>Baixar logs admin CSV</button>
    {error && <p className="error-text">{error}</p>}
    {data && <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(data, null, 2)}</pre>}
  </section>;
}
