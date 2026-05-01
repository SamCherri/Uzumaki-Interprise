import { FormEvent, useEffect, useMemo, useState } from 'react';
import { api, getCurrentUser } from '../services/api';

type Wallet = { fiatBalance: string; rpcBalance: string };
type Market = { currentPrice: string };
type Trade = { id: string; unitPrice?: string; priceAfter?: string; createdAt: string };
type LeaderboardRow = { userId: string; characterName: string; fiatBalance: string; rpcBalance: string; estimatedTotal: string };
type Quote = { estimatedQuantity?: string; estimatedFiat?: string; effectivePrice: string; priceAfter: string };

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
  const [isBuying, setIsBuying] = useState(false);
  const [isSelling, setIsSelling] = useState(false);
  const [isSendingReport, setIsSendingReport] = useState(false);
  const [reportType, setReportType] = useState('BUG');
  const [reportLocation, setReportLocation] = useState('');
  const [reportDescription, setReportDescription] = useState('');

  async function loadAll() {
    setLoading(true);
    setError('');
    try {
      const [w, m, t, l, meData] = await Promise.all([
        api<Wallet>('/test-mode/me'),
        api<Market>('/test-mode/market'),
        api<{ trades: Trade[] }>('/test-mode/trades?limit=200'),
        api<LeaderboardRow[]>('/test-mode/leaderboard'),
        getCurrentUser().catch(() => null),
      ]);
      setWallet(w);
      setMarket(m);
      setTrades(t.trades ?? []);
      setLeaderboard(l);
      setMe(meData?.user ? { id: meData.user.id } : null);
    } catch (e) {
      setError((e as Error).message || 'Falha ao carregar Modo Teste.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadAll(); }, []);

  useEffect(() => {
    const fiat = Number(fiatAmount);
    if (!fiat || fiat <= 0) { setBuyQuote(null); return; }
    void api<Quote>('/test-mode/quote-buy', { method: 'POST', body: JSON.stringify({ fiatAmount: fiat }) }).then(setBuyQuote).catch(() => setBuyQuote(null));
  }, [fiatAmount]);

  useEffect(() => {
    const rpc = Number(rpcAmount);
    if (!rpc || rpc <= 0) { setSellQuote(null); return; }
    void api<Quote>('/test-mode/quote-sell', { method: 'POST', body: JSON.stringify({ rpcAmount: rpc }) }).then(setSellQuote).catch(() => setSellQuote(null));
  }, [rpcAmount]);

  const total = useMemo(() => wallet && market ? Number(wallet.fiatBalance) + Number(wallet.rpcBalance) * Number(market.currentPrice) : 0, [wallet, market]);
  const prices = useMemo(() => {
    if (!market) return [] as number[];
    if (trades.length === 0) return [Number(market.currentPrice), Number(market.currentPrice)];
    const fromTrades = trades.map((t) => Number(t.priceAfter ?? t.unitPrice ?? market.currentPrice)).filter((v) => Number.isFinite(v) && v > 0);
    if (fromTrades.length === 1) return [fromTrades[0], fromTrades[0]];
    return fromTrades;
  }, [trades, market]);

  async function handleBuy() {
    try {
      setIsBuying(true); setError('');
      await api('/test-mode/buy', { method: 'POST', body: JSON.stringify({ fiatAmount: Number(fiatAmount) }) });
      setMessage('Compra de teste realizada.');
      await loadAll();
    } catch (e) { setError((e as Error).message); } finally { setIsBuying(false); }
  }

  async function handleSell() {
    try {
      setIsSelling(true); setError('');
      await api('/test-mode/sell', { method: 'POST', body: JSON.stringify({ rpcAmount: Number(rpcAmount) }) });
      setMessage('Venda de teste realizada.');
      await loadAll();
    } catch (e) { setError((e as Error).message); } finally { setIsSelling(false); }
  }

  async function handleReportSubmit(event: FormEvent) {
    event.preventDefault();
    try {
      setIsSendingReport(true); setError('');
      await api('/test-mode/reports', { method: 'POST', body: JSON.stringify({ type: reportType, location: reportLocation, description: reportDescription }) });
      setMessage('Report enviado com sucesso.');
      setReportType('BUG'); setReportLocation(''); setReportDescription('');
      await loadAll();
    } catch (e) { setError((e as Error).message); } finally { setIsSendingReport(false); }
  }

  return <section className="card">
    <h2>🧪 Modo Teste da RPC Exchange</h2>
    <p className="warning">Modo Teste ativo. As operações desta tela não afetam a Exchange principal.</p>
    {loading && <p>Carregando dados do modo teste...</p>}
    {error && <p className="warning">{error}</p>}
    {message && <p>{message}</p>}

    <article className="nested-card">
      <h3>Mercado teste (gráfico)</h3>
      <svg viewBox="0 0 320 140" width="100%" height="140" role="img" aria-label="Gráfico de preço do modo teste">
        <line x1="10" y1="120" x2="310" y2="120" stroke="#777" strokeWidth="1" />
        {prices.length > 0 && (() => {
          const min = Math.min(...prices); const max = Math.max(...prices); const range = max - min || 1;
          const points = prices.map((p, i) => {
            const x = 10 + (300 * i) / Math.max(1, prices.length - 1);
            const y = 20 + ((max - p) / range) * 100;
            return `${x},${y}`;
          }).join(' ');
          return <>
            <polyline points={points} fill="none" stroke="#3fa7ff" strokeWidth="3" />
            <circle cx={points.split(' ').at(-1)?.split(',')[0]} cy={points.split(' ').at(-1)?.split(',')[1]} r="4" fill="#3fa7ff" />
          </>;
        })()}
      </svg>
      {trades.length === 0 && <p>Preço inicial / atual do modo teste.</p>}
    </article>

    <p>Saldo teste R$: {wallet?.fiatBalance ?? '-'}</p><p>Saldo teste RPC: {wallet?.rpcBalance ?? '-'}</p><p>Patrimônio estimado: R$ {total.toFixed(2)}</p><p>Preço atual RPC/R$: {market?.currentPrice ?? '-'}</p>

    <div className="nested-card"><h3>Comprar RPC teste</h3><input value={fiatAmount} onChange={(e)=>setFiatAmount(e.target.value)} />
      {buyQuote && <p>Qtd. estimada: {buyQuote.estimatedQuantity ?? '-'} | Preço efetivo: {buyQuote.effectivePrice} | Preço após: {buyQuote.priceAfter}</p>}
      <button disabled={isBuying} onClick={handleBuy}>{isBuying ? 'Comprando...' : 'Comprar RPC de teste'}</button></div>

    <div className="nested-card"><h3>Vender RPC teste</h3><input value={rpcAmount} onChange={(e)=>setRpcAmount(e.target.value)} />
      {sellQuote && <p>R$ estimado: {sellQuote.estimatedFiat ?? '-'} | Preço efetivo: {sellQuote.effectivePrice} | Preço após: {sellQuote.priceAfter}</p>}
      <button disabled={isSelling} onClick={handleSell}>{isSelling ? 'Vendendo...' : 'Vender RPC de teste'}</button></div>

    <article className="nested-card"><h3>Ranking do modo teste</h3>
      {leaderboard.map((row, idx) => <div key={row.userId} style={{ fontWeight: row.userId === me?.id ? 700 : 400 }}>
        #{idx + 1} {row.characterName} • R$ {row.fiatBalance} • RPC {row.rpcBalance} • Patrimônio {row.estimatedTotal}
      </div>)}
    </article>

    <form className="nested-card" onSubmit={handleReportSubmit}><h3>Enviar report</h3>
      <select value={reportType} onChange={(e)=>setReportType(e.target.value)}>
        <option value="BUG">BUG</option><option value="VISUAL_ERROR">VISUAL_ERROR</option><option value="BALANCE_ERROR">BALANCE_ERROR</option><option value="CHEAT_SUSPECTED">CHEAT_SUSPECTED</option><option value="SUGGESTION">SUGGESTION</option><option value="OTHER">OTHER</option>
      </select>
      <input value={reportLocation} onChange={(e)=>setReportLocation(e.target.value)} placeholder="Local do problema" required />
      <textarea value={reportDescription} onChange={(e)=>setReportDescription(e.target.value)} placeholder="Descreva o problema" required />
      <button type="submit" disabled={isSendingReport}>{isSendingReport ? 'Enviando...' : 'Enviar report'}</button>
    </form>
  </section>;
}
