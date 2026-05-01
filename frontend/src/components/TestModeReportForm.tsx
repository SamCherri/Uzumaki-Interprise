import { FormEvent, useState } from 'react';
import { api } from '../services/api';

const REPORT_TYPES = [
  { value: 'BUG', label: 'Bug' },
  { value: 'VISUAL_ERROR', label: 'Erro visual' },
  { value: 'BALANCE_ERROR', label: 'Erro de saldo' },
  { value: 'CHEAT_SUSPECTED', label: 'Suspeita de trapaça' },
  { value: 'SUGGESTION', label: 'Sugestão' },
  { value: 'OTHER', label: 'Outro' },
] as const;

type TestModeReportFormProps = {
  className?: string;
  title?: string;
};

export function TestModeReportForm({ className = 'card nested-card market-tab-panel', title = 'Reportar erro/trapaça' }: TestModeReportFormProps) {
  const [isSendingReport, setIsSendingReport] = useState(false);
  const [reportType, setReportType] = useState('BUG');
  const [reportLocation, setReportLocation] = useState('');
  const [reportDescription, setReportDescription] = useState('');
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  async function handleReportSubmit(event: FormEvent) {
    event.preventDefault();

    try {
      setIsSendingReport(true);
      setStatusMessage(null);
      await api('/test-mode/reports', { method: 'POST', body: JSON.stringify({ type: reportType, location: reportLocation, description: reportDescription }) });
      setStatusMessage({ type: 'success', text: 'Report enviado com sucesso.' });
      setReportType('BUG');
      setReportLocation('');
      setReportDescription('');
    } catch {
      setStatusMessage({ type: 'error', text: 'Não foi possível enviar o report agora. Tente novamente em instantes.' });
    } finally {
      setIsSendingReport(false);
    }
  }

  return (
    <form className={className} onSubmit={handleReportSubmit}>
      <h4>{title}</h4>
      {statusMessage && <p className={`status-message ${statusMessage.type}`}>{statusMessage.text}</p>}
      <label>Tipo do report<select value={reportType} onChange={(e) => setReportType(e.target.value)}>{REPORT_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
      <label>Local do problema<input value={reportLocation} onChange={(e) => setReportLocation(e.target.value)} required /></label>
      <label>Descrição<textarea value={reportDescription} onChange={(e) => setReportDescription(e.target.value)} required /></label>
      <button type="submit" disabled={isSendingReport}>{isSendingReport ? 'Enviando...' : 'Enviar report'}</button>
    </form>
  );
}
