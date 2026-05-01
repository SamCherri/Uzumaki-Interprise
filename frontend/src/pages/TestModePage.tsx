import { useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';

type Wallet = { fiatBalance: string; rpcBalance: string; userId?: string };
type Market = { currentPrice: string };
type Trade = { id: string; priceAfter: string; unitPrice: string; createdAt: string };
type Leader = { position: number; userId: string; characterName?: string | null; fiatBalance: string; rpcBalance: string; estimatedTotalFiat: string };

type ReportType = 'BUG'|'VISUAL_ERROR'|'BALANCE_ERROR'|'CHEAT_SUSPECTED'|'SUGGESTION'|'OTHER';

export function TestModePage() {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [market, setMarket] = useState<Market | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [leaderboard, setLeaderboard] = useState<Leader[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [fiatAmount, setFiatAmount] = useState('100');
  const [rpcAmount, setRpcAmount] = useState('10');
  const [buyQuote, setBuyQuote] = useState<any>(null);
  const [sellQuote, setSellQuote] = useState<any>(null);
  const [isBuying, setIsBuying] = useState(false);
  const [isSelling, setIsSelling] = useState(false);

  const [reportType, setReportType] = useState<ReportType>('BUG');
  const [reportLocation, setReportLocation] = useState('TestModePage');
  const [reportDescription, setReportDescription] = useState('');
  const [isSendingReport, setIsSendingReport] = useState(false);

  async function loadAll() {
    setLoading(true); setError('');
    try {
      const [w, m, t, l] = await Promise.all([
        api<Wallet>('/test-mode/me'),
        api<Market>('/test-mode/market'),
        api<{ trades: Trade[] }>('/test-mode/trades?limit=200'),
        api<{ leaderboard: Leader[] }>('/test-mode/leaderboard'),
      ]);
      setWallet(w); setMarket(m); setTrades(t.trades); setLeaderboard(l.leaderboard);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }

  useEffect(() => { void loadAll(); }, []);
  useEffect(() => {
    const id = window.setInterval(() => { void loadAll(); }, 15000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => { (async () => { try { if (!fiatAmount) return setBuyQuote(null); setBuyQuote(await api(`/test-mode/quote-buy?fiatAmount=${Number(fiatAmount)}`)); } catch { setBuyQuote(null); } })(); }, [fiatAmount]);
  useEffect(() => { (async () => { try { if (!rpcAmount) return setSellQuote(null); setSellQuote(await api(`/test-mode/quote-sell?rpcAmount=${Number(rpcAmount)}`)); } catch { setSellQuote(null); } })(); }, [rpcAmount]);

  const total = useMemo(() => wallet && market ? Number(wallet.fiatBalance) + Number(wallet.rpcBalance) * Number(market.currentPrice) : 0, [wallet, market]);
  const series = trades.length ? trades.slice().reverse().map((t) => Number(t.priceAfter || t.unitPrice)) : [Number(market?.currentPrice ?? 1)];
  const min = Math.min(...series); const max = Math.max(...series); const span = max - min || 1;
  const points = series.map((v, i) => `${(i/(Math.max(series.length-1,1)))*300},${120-((v-min)/span)*100}`).join(' ');

  async function buy() { setIsBuying(true); setMessage(''); try { await api('/test-mode/buy', { method: 'POST', body: JSON.stringify({ fiatAmount: Number(fiatAmount) }) }); setMessage('Compra realizada.'); await loadAll(); } catch (e) { setError((e as Error).message); } finally { setIsBuying(false); } }
  async function sell() { setIsSelling(true); setMessage(''); try { await api('/test-mode/sell', { method: 'POST', body: JSON.stringify({ rpcAmount: Number(rpcAmount) }) }); setMessage('Venda realizada.'); await loadAll(); } catch (e) { setError((e as Error).message); } finally { setIsSelling(false); } }
  async function sendReport() { setIsSendingReport(true); setMessage(''); try { await api('/test-mode/reports', { method: 'POST', body: JSON.stringify({ type: reportType, location: reportLocation, description: reportDescription }) }); setMessage('Report enviado com sucesso.'); setReportDescription(''); } catch (e) { setError((e as Error).message); } finally { setIsSendingReport(false); } }

  if (loading) return <section className="card"><h2>🧪 Modo Teste da RPC Exchange</h2><p>Carregando dados do modo teste...</p></section>;

  return <section className="card"><h2>🧪 Modo Teste da RPC Exchange</h2><p className="warning">Modo Teste ativo. As operações desta tela não afetam a Exchange principal.</p>
    {error && <p className="status-message error">{error}</p>}
    {message && <p className="status-message success">{message}</p>}
    <p>Saldo teste R$: {wallet?.fiatBalance ?? '-'}</p><p>Saldo teste RPC: {wallet?.rpcBalance ?? '-'}</p><p>Patrimônio estimado: R$ {total.toFixed(2)}</p><p>Preço atual RPC/R$: {market?.currentPrice ?? '-'}</p>

    <h3>📈 Gráfico modo teste</h3>
    <svg width="100%" viewBox="0 0 300 130" style={{ background: '#111', borderRadius: 12 }}><polyline points={points} fill="none" stroke="#22d3ee" strokeWidth="3" />{series.length===1 && <circle cx="150" cy="70" r="4" fill="#22d3ee"/>}</svg>
    <p className="info-text">{trades.length ? `Baseado em ${trades.length} trades de teste.` : 'Preço inicial / atual do modo teste.'}</p>

    <h3>💱 Comprar RPC de teste</h3>
    <input value={fiatAmount} onChange={(e)=>setFiatAmount(e.target.value)} />
    {buyQuote && <p className="info-text">Estimado: {buyQuote.estimatedRpcAmount} RPC · Preço efetivo: {buyQuote.effectiveUnitPrice} · Preço após: {buyQuote.estimatedPriceAfter}</p>}
    <button onClick={buy} disabled={isBuying}>{isBuying ? 'Comprando...' : 'Comprar'}</button>

    <h3>💱 Vender RPC de teste</h3>
    <input value={rpcAmount} onChange={(e)=>setRpcAmount(e.target.value)} />
    {sellQuote && <p className="info-text">Estimado: R$ {sellQuote.estimatedFiatAmount} · Preço efetivo: {sellQuote.effectiveUnitPrice} · Preço após: {sellQuote.estimatedPriceAfter}</p>}
    <button onClick={sell} disabled={isSelling}>{isSelling ? 'Vendendo...' : 'Vender'}</button>

    <h3>🏆 Ranking</h3>
    <div className="mobile-card-list">{leaderboard.map((l) => <article key={l.userId} className="summary-item compact-card"><strong>#{l.position} {l.characterName ?? l.userId}</strong><p>R$ {l.fiatBalance} | RPC {l.rpcBalance}</p><p>Patrimônio: R$ {l.estimatedTotalFiat}</p></article>)}</div>

    <h3>🐞 Reportar erro / trapaça</h3>
    <select value={reportType} onChange={(e)=>setReportType(e.target.value as ReportType)}><option>BUG</option><option>VISUAL_ERROR</option><option>BALANCE_ERROR</option><option>CHEAT_SUSPECTED</option><option>SUGGESTION</option><option>OTHER</option></select>
    <input value={reportLocation} onChange={(e)=>setReportLocation(e.target.value)} placeholder="Local" />
    <textarea value={reportDescription} onChange={(e)=>setReportDescription(e.target.value)} placeholder="Descreva o problema" />
    <button onClick={sendReport} disabled={isSendingReport}>{isSendingReport ? 'Enviando...' : 'Enviar report'}</button>
  </section>;
}
