import { useEffect, useState } from 'react';
import { api } from '../services/api';

type AlertSeverity = 'CRITICAL' | 'WARNING';

type EconomicAlert = {
  code: string;
  severity: AlertSeverity;
  title: string;
  description: string;
  entity: string;
  entityId: string;
  userId?: string;
  details: Record<string, unknown>;
};

type EconomicAlertsResponse = {
  summary: { total: number; critical: number; warning: number };
  alerts: EconomicAlert[];
};

export function AdminEconomicAlertsPanel() {
  const [data, setData] = useState<EconomicAlertsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function loadAlerts() {
    setLoading(true);
    setError('');
    try {
      const response = await api<EconomicAlertsResponse>('/admin/economic-alerts');
      setData(response);
    } catch (err) {
      setError((err as Error).message || 'Falha ao carregar alertas econômicos.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAlerts();
  }, []);

  return (
    <section className="stack-md">
      <div className="section-header">
        <div>
          <h3>Alertas econômicos</h3>
          <p>Monitoramento de inconsistências para prevenção de bugs no mercado.</p>
        </div>
        <button className="button-secondary" onClick={loadAlerts} disabled={loading}>
          {loading ? 'Atualizando...' : 'Atualizar alertas'}
        </button>
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="summary-grid">
        <article className="summary-item compact-card"><strong>Total</strong><p>{data?.summary.total ?? 0}</p></article>
        <article className="summary-item compact-card"><strong>Críticos</strong><p>{data?.summary.critical ?? 0}</p></article>
        <article className="summary-item compact-card"><strong>Avisos</strong><p>{data?.summary.warning ?? 0}</p></article>
      </div>

      {data && data.alerts.length === 0 && !loading && (
        <article className="summary-item">
          <strong>Nenhuma inconsistência econômica detectada.</strong>
        </article>
      )}

      <div className="stack-sm">
        {data?.alerts.map((alert) => (
          <article key={`${alert.code}-${alert.entityId}-${alert.userId ?? 'na'}`} className="summary-item">
            <strong>{alert.severity} • {alert.title}</strong>
            <p>{alert.description}</p>
            <p><strong>Entidade:</strong> {alert.entity} ({alert.entityId})</p>
            {alert.userId && <p><strong>Usuário:</strong> {alert.userId}</p>}
            <p><strong>Código:</strong> {alert.code}</p>
            <details>
              <summary>Detalhes técnicos</summary>
              <pre>{JSON.stringify(alert.details, null, 2)}</pre>
            </details>
          </article>
        ))}
      </div>
    </section>
  );
}
