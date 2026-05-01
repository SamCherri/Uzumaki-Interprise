import { useEffect, useState } from 'react';
import { api } from '../services/api';

type LeaderboardRow = { userId: string; name?: string | null; characterName?: string | null; fiatBalance: string; rpcBalance: string; estimatedTotalFiat: string; position?: number };

export function TestModeRankingPage() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [meId, setMeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadRanking() {
    setError('');
    const me = await api<{ userId?: string }>('/test-mode/me');
    const board = await api<{ leaderboard: LeaderboardRow[] }>('/test-mode/leaderboard');
    setMeId(me.userId ?? null);
    setLeaderboard((board.leaderboard ?? []).sort((a, b) => Number(b.estimatedTotalFiat) - Number(a.estimatedTotalFiat)));
  }

  useEffect(() => {
    setLoading(true);
    loadRanking().catch((e: Error) => setError(e.message || 'Falha ao carregar ranking.')).finally(() => setLoading(false));
  }, []);

  return <section className="card market-page market-shell"><div className="trade-screen market-mobile-shell">
    <header className="card trade-header market-pair-header"><p className="company-emoji">🏆 Ranking do Modo Teste</p><p className="warning">Ranking exclusivo do modo teste. Nenhum saldo desta tela afeta a Exchange principal.</p><button className="button-primary" onClick={() => loadRanking().catch(() => setError('Não foi possível atualizar o ranking.'))}>Atualizar ranking</button></header>
    {loading && <p>Carregando ranking...</p>}
    {error && <p className="status-message error">{error}</p>}
    {!loading && leaderboard.length === 0 && <p className="empty-state">Nenhum jogador no ranking ainda.</p>}
    <section className="card nested-card market-tab-panel"><div className="mobile-card-list">{leaderboard.map((row, idx) => <article key={row.userId} className="summary-item" style={{ borderColor: row.userId === meId ? '#22c55e' : undefined }}><p><strong>Posição #{row.position ?? idx + 1} · {row.characterName ?? row.name ?? 'Jogador'}</strong> {row.userId === meId ? '(Você)' : ''}</p><p>Saldo R$ teste: {row.fiatBalance}</p><p>Saldo RPC teste: {row.rpcBalance}</p><p><strong>Patrimônio total estimado: R$ {row.estimatedTotalFiat}</strong></p></article>)}</div></section>
  </div></section>;
}
