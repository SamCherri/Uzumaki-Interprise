import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { api, getCurrentUser } from '../services/api';

type Wallet = { fiatBalance: string; rpcBalance: string; userId?: string };
type Market = { currentPrice: string; fiatReserve: string; rpcReserve: string; updatedAt?: string };
type Trade = { id: string; side: 'BUY' | 'SELL' | 'BUY_RPC' | 'SELL_RPC'; fiatAmount: string; rpcAmount: string; unitPrice?: string; priceAfter?: string; priceBefore?: string; createdAt: string };
type LeaderboardRow = { userId: string; name?: string | null; characterName?: string | null; fiatBalance: string; rpcBalance: string; estimatedTotalFiat: string };
type Quote = { estimatedRpcAmount?: string; estimatedFiatAmount?: string; effectiveUnitPrice: string; estimatedPriceAfter: string };
type BotTickResponse = { skipped?: boolean; message?: string; side?: 'BUY' | 'SELL'; fiatAmount?: string; rpcAmount?: string; priceBefore?: string; priceAfter?: string; currentPrice?: string };

const REPORT_TYPES = [
  { value: 'BUG', label: 'Bug' },
  { value: 'VISUAL_ERROR', label: 'Erro visual' },
  { value: 'BALANCE_ERROR', label: 'Erro de saldo' },
  { value: 'CHEAT_SUSPECTED', label: 'Suspeita de trapaça' },
  { value: 'SUGGESTION', label: 'Sugestão' },
  { value: 'OTHER', label: 'Outro' },
] as const;

export function TestModePage() {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [market, setMarket] = useState<Market | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [me, setMe] = useState<{ id: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [fiatAmount, setFiatAmount] = useState('100');
  const [rpcAmount, setRpcAmount] = useState('10');
  const [buyQuote, setBuyQuote] = useState<Quote | null>(null);
  const [sellQuote, setSellQuote] = useState<Quote | null>(null);
  const [activeSide, setActiveSide] = useState<'buy' | 'sell'>('buy');
  const [isBuying, setIsBuying] = useState(false);
  const [isSelling, setIsSelling] = useState(false);
  const [isSendingReport, setIsSendingReport] = useState(false);
  const [reportType, setReportType] = useState('BUG');
  const [reportLocation, setReportLocation] = useState('');
  const [reportDescription, setReportDescription] = useState('');
  const isInitialLoadDoneRef = useRef(false);
  const [lastBotTick, setLastBotTick] = useState<BotTickResponse | null>(null);
  const [botTickHistory, setBotTickHistory] = useState<BotTickResponse[]>([]);

  async function loadAll() {
    setLoading(true);
    setError('');

    try {
      const w = await api<Wallet>('/test-mode/me');
      const [m, t, l, meData] = await Promise.all([
        api<Market>('/test-mode/market'),
        api<{ trades: Trade[] }>('/test-mode/trades?limit=200'),
        api<{ leaderboard: LeaderboardRow[] }>('/test-mode/leaderboard'),
        getCurrentUser().catch(() => null),
      ]);

      setWallet(w);
      setMarket(m);
      setTrades(t.trades ?? []);
      setLeaderboard((l.leaderboard ?? []).sort((a, b) => Number(b.estimatedTotalFiat) - Number(a.estimatedTotalFiat)));
      setMe(w.userId ? { id: w.userId } : meData?.user ? { id: meData.user.id } : null);
    } catch (e) {
      setError((e as Error).message || 'Falha ao carregar Modo Teste.');
    } finally {
      setLoading(false);
      isInitialLoadDoneRef.current = true;
    }
  }

  useEffect(() => {
    void loadAll();
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (!isInitialLoadDoneRef.current || document.visibilityState !== 'visible') return;
      void api<BotTickResponse>('/test-mode/bot-tick', { method: 'POST' })
        .then((tick) => {
          if (tick.skipped) {
            setLastBotTick(tick);
            return;
          }
          setLastBotTick(tick);
          setBotTickHistory((items) => [...items, tick].slice(-50));
          return loadAll();
        })
        .catch(() => undefined);
    }, 30000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const fiat = Number(fiatAmount);
    if (!fiat || fiat <= 0) {
      setBuyQuote(null);
      return;
    }
    void api<Quote>(`/test-mode/quote-buy?fiatAmount=${encodeURIComponent(String(fiat))}`).then(setBuyQuote).catch(() => setBuyQuote(null));
  }, [fiatAmount]);

  useEffect(() => {
    const rpc = Number(rpcAmount);
    if (!rpc || rpc <= 0) {
      setSellQuote(null);
      return;
    }
    void api<Quote>(`/test-mode/quote-sell?rpcAmount=${encodeURIComponent(String(rpc))}`).then(setSellQuote).catch(() => setSellQuote(null));
  }, [rpcAmount]);

  const total = useMemo(() => wallet && market ? Number(wallet.fiatBalance) + Number(wallet.rpcBalance) * Number(market.currentPrice) : 0, [wallet, market]);
  const chartTrades = useMemo(() => [...trades].reverse(), [trades]);
  const chartPrices = useMemo(() => {
    if (!market) return [1, 1];
    const tradePrices = chartTrades
      .map((trade) => Number(trade.priceAfter ?? trade.unitPrice ?? market.currentPrice))
      .filter((value) => Number.isFinite(value) && value > 0);
    const botPrices = botTickHistory
      .map((tick) => Number(tick.priceAfter ?? tick.currentPrice ?? market.currentPrice))
      .filter((value) => Number.isFinite(value) && value > 0);
    const marketPrice = Number(market.currentPrice);
    const points = [...tradePrices, ...botPrices];

    if (Number.isFinite(marketPrice) && marketPrice > 0) {
      points.push(marketPrice);
    }

    if (points.length === 0) return [marketPrice || 1, marketPrice || 1];
    if (points.length === 1) return [points[0], points[0]];

    return points;
  }, [chartTrades, botTickHistory, market]);

  async function handleBuy() {
    try {
      setIsBuying(true);
      setError('');
      await api('/test-mode/buy', { method: 'POST', body: JSON.stringify({ fiatAmount: Number(fiatAmount) }) });
      setMessage('Compra de teste realizada.');
      await loadAll();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIsBuying(false);
    }
  }

  async function handleSell() {
    try {
      setIsSelling(true);
      setError('');
      await api('/test-mode/sell', { method: 'POST', body: JSON.stringify({ rpcAmount: Number(rpcAmount) }) });
      setMessage('Venda de teste realizada.');
      await loadAll();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIsSelling(false);
    }
  }

  async function handleReportSubmit(event: FormEvent) {
    event.preventDefault();

    try {
      setIsSendingReport(true);
      setError('');
      await api('/test-mode/reports', { method: 'POST', body: JSON.stringify({ type: reportType, location: reportLocation, description: reportDescription }) });
      setMessage('Report enviado com sucesso.');
      setReportType('BUG');
      setReportLocation('');
      setReportDescription('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIsSendingReport(false);
    }
  }

  return <section className="card market-page market-shell"><p className="warning">Modo Teste ativo. Nenhuma operação desta tela afeta a Exchange principal.</p><p className="info-text">O mercado de teste possui movimentações simuladas para ajudar os jogadores a testar lucro, prejuízo e bugs.</p>
    {loading && <p>Carregando dados do modo teste...</p>}{error && <p className="status-message error">{error}</p>}{message && <p className="status-message success">{message}</p>}
    {lastBotTick?.skipped && <p className="info-text">Aguardando próxima janela de simulação.</p>}
    {lastBotTick && !lastBotTick.skipped && <article className="card nested-card"><h4>Última movimentação simulada</h4><p>Side: {lastBotTick.side}</p><p>fiatAmount: {lastBotTick.fiatAmount}</p><p>rpcAmount: {lastBotTick.rpcAmount}</p><p>priceBefore: {lastBotTick.priceBefore}</p><p>priceAfter: {lastBotTick.priceAfter}</p><p>currentPrice: {lastBotTick.currentPrice}</p></article>}
    <div className="trade-screen market-mobile-shell">
      <header className="card trade-header market-pair-header"><p className="company-emoji">🧪 Modo Teste RPC/R$</p><h3 className="trade-price-big">R$ {Number(market?.currentPrice ?? 0).toFixed(4)}</h3><div className="market-stats-row"><div className="market-mini-stat-card"><span className="market-mini-stat-label">Saldo R$ teste</span><strong>R$ {Number(wallet?.fiatBalance ?? 0).toFixed(2)}</strong></div><div className="market-mini-stat-card"><span className="market-mini-stat-label">Saldo RPC teste</span><strong>{Number(wallet?.rpcBalance ?? 0).toFixed(2)} RPC</strong></div><div className="market-mini-stat-card"><span className="market-mini-stat-label">Patrimônio estimado</span><strong>R$ {total.toFixed(2)}</strong></div><div className="market-mini-stat-card"><span className="market-mini-stat-label">Atualizado</span><strong>{market?.updatedAt ? new Date(market.updatedAt).toLocaleString('pt-BR') : '--'}</strong></div></div></header>
      <section className="card nested-card market-tab-panel"><h4>Preço RPC/R$ (teste)</h4><div className="chart-wrap chart-wrap-highlight modern-chart-shell"><svg viewBox="0 0 100 100" preserveAspectRatio="none" className="line-chart">{(() => { const min = Math.min(...chartPrices); const max = Math.max(...chartPrices); const range = max - min || 1; const points = chartPrices.map((p, i) => `${(i / Math.max(1, chartPrices.length - 1)) * 84},${100 - ((p - min) / range) * 100}`).join(' '); if (chartTrades.length >= 2) return <polyline points={points} fill="none" stroke="#38bdf8" strokeWidth="2.6" />; if (chartTrades.length === 1) return <line x1="0" x2="84" y1={points.split(',')[1]} y2={points.split(',')[1]} stroke="#38bdf8" strokeWidth="2.6" />; return <line x1="0" x2="84" y1="50" y2="50" stroke="#38bdf8" strokeWidth="2.6" />; })()}</svg></div></section>
      <section className="card nested-card market-tab-panel"><h4>Painel de negociação</h4><div className="quick-actions"><button className={activeSide === 'buy' ? 'quick-pill active' : 'quick-pill'} onClick={() => setActiveSide('buy')}>Comprar RPC</button><button className={activeSide === 'sell' ? 'quick-pill active' : 'quick-pill'} onClick={() => setActiveSide('sell')}>Vender RPC</button></div>{activeSide === 'buy' ? <div className="form-grid nested-card buy-side"><input type="number" inputMode="decimal" min="0" step="0.01" value={fiatAmount} onChange={(e) => setFiatAmount(e.target.value)} /><p className="info-text">Entrada em R$: {fiatAmount || '0'}</p><p className="info-text">Saída estimada em RPC: {buyQuote?.estimatedRpcAmount ?? '-'}</p><p className="info-text">Preço efetivo: {buyQuote?.effectiveUnitPrice ?? '-'}</p><p className="info-text">Preço antes: {market?.currentPrice ?? '-'}</p><p className="info-text">Preço depois: {buyQuote?.estimatedPriceAfter ?? '-'}</p><p className="info-text">Variação estimada: {buyQuote ? (Number(buyQuote.estimatedPriceAfter) - Number(market?.currentPrice ?? 0)).toFixed(6) : '-'}</p><button className="button-success" disabled={isBuying || !buyQuote} onClick={handleBuy}>{isBuying ? 'Comprando...' : 'Comprar RPC de teste'}</button></div> : <div className="form-grid nested-card sell-side"><input type="number" inputMode="decimal" min="0" step="0.01" value={rpcAmount} onChange={(e) => setRpcAmount(e.target.value)} /><p className="info-text">Entrada em RPC: {rpcAmount || '0'}</p><p className="info-text">Saída estimada em R$: {sellQuote?.estimatedFiatAmount ?? '-'}</p><p className="info-text">Preço efetivo: {sellQuote?.effectiveUnitPrice ?? '-'}</p><p className="info-text">Preço antes: {market?.currentPrice ?? '-'}</p><p className="info-text">Preço depois: {sellQuote?.estimatedPriceAfter ?? '-'}</p><p className="info-text">Variação estimada: {sellQuote ? (Number(sellQuote.estimatedPriceAfter) - Number(market?.currentPrice ?? 0)).toFixed(6) : '-'}</p><button className="button-danger" disabled={isSelling || !sellQuote} onClick={handleSell}>{isSelling ? 'Vendendo...' : 'Vender RPC de teste'}</button></div>}</section>
      <section className="card nested-card market-book-tab market-tab-panel"><h4>Profundidade/liquidez de teste</h4><div className="order-book-grid"><div className="summary-item"><span className="summary-label">Reserva R$ teste</span><strong>R$ {Number(market?.fiatReserve ?? 0).toFixed(2)}</strong></div><div className="summary-item"><span className="summary-label">Reserva RPC teste</span><strong>{Number(market?.rpcReserve ?? 0).toFixed(2)} RPC</strong></div></div></section>
      <section className="card nested-card market-tab-panel"><h4>Últimos trades</h4><div className="mobile-card-list">{trades.length === 0 && <p className="empty-state">Sem negociações ainda.</p>}{trades.slice(0, 20).map((trade) => { const isBuy = trade.side === 'BUY' || trade.side === 'BUY_RPC'; return <article key={trade.id} className="summary-item compact-card"><p><strong>{isBuy ? 'COMPRA' : 'VENDA'}</strong> · {new Date(trade.createdAt).toLocaleString('pt-BR')}</p><p>RPC: {trade.rpcAmount}</p><p>Total R$: {trade.fiatAmount}</p><p>Preço unitário: {trade.unitPrice ?? '-'}</p></article>; })}</div></section>
      <section className="card nested-card market-tab-panel"><h4>Ranking do Modo Teste</h4>{leaderboard.length === 0 && <p className="empty-state">Nenhum jogador no ranking ainda.</p>}<div className="mobile-card-list">{leaderboard.map((row, idx) => <article key={row.userId} className="summary-item" style={{ borderColor: row.userId === me?.id ? '#22c55e' : undefined }}><p><strong>Posição #{idx + 1} · {row.characterName ?? row.name ?? 'Jogador'}</strong> {idx < 3 ? '🏆' : ''} {row.userId === me?.id ? '(Você)' : ''}</p><p>Saldo R$ teste: {row.fiatBalance}</p><p>Saldo RPC teste: {row.rpcBalance}</p><p><strong>Patrimônio total estimado: R$ {row.estimatedTotalFiat}</strong></p></article>)}</div></section>
      <form className="card nested-card market-tab-panel" onSubmit={handleReportSubmit}><h4>Reportar erro/trapaça</h4><label>Tipo do report<select value={reportType} onChange={(e) => setReportType(e.target.value)}>{REPORT_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><label>Local do problema<input value={reportLocation} onChange={(e) => setReportLocation(e.target.value)} required /></label><label>Descrição<textarea value={reportDescription} onChange={(e) => setReportDescription(e.target.value)} required /></label><button type="submit" disabled={isSendingReport}>{isSendingReport ? 'Enviando...' : 'Enviar report'}</button></form>
    </div></section>;
}
