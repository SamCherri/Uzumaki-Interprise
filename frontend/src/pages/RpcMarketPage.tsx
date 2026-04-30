import { FormEvent, useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';
import { formatCurrency, formatPercent, formatPrice, formatSignedPrice } from '../utils/formatters';

type MarketState = { currentPrice: string; fiatReserve: string; rpcReserve: string; totalFiatVolume: string; totalRpcVolume: string; totalBuys: number; totalSells: number; updatedAt: string; };
type Trade = { id: string; side: 'BUY_RPC' | 'SELL_RPC'; fiatAmount: string; rpcAmount: string; unitPrice: string; priceBefore: string; priceAfter: string; createdAt: string; };
type BuyQuote = { estimatedRpcAmount: string; effectiveUnitPrice: string };
type SellQuote = { estimatedFiatAmount: string; effectiveUnitPrice: string };
type Timeframe = '1H' | '24H' | '7D' | '30D' | 'ALL';

const timeframes: { key: Timeframe; label: string; hours: number | null }[] = [
  { key: '1H', label: '1H', hours: 1 },
  { key: '24H', label: '24H', hours: 24 },
  { key: '7D', label: '7D', hours: 24 * 7 },
  { key: '30D', label: '30D', hours: 24 * 30 },
  { key: 'ALL', label: 'ALL', hours: null },
];

export function RpcMarketPage() {
  const [market, setMarket] = useState<MarketState | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [wallet, setWallet] = useState<{ fiatAvailableBalance: string; rpcAvailableBalance: string } | null>(null);
  const [fiatAmount, setFiatAmount] = useState('');
  const [rpcAmount, setRpcAmount] = useState('');
  const [buyQuote, setBuyQuote] = useState<BuyQuote | null>(null);
  const [sellQuote, setSellQuote] = useState<SellQuote | null>(null);
  const [buyQuoteError, setBuyQuoteError] = useState('');
  const [sellQuoteError, setSellQuoteError] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [activeSide, setActiveSide] = useState<'buy' | 'sell'>('buy');
  const [activeTimeframe, setActiveTimeframe] = useState<Timeframe>('24H');

  async function load() {
    setIsLoading(true);
    const [marketData, tradesData, me] = await Promise.all([
      api<MarketState>('/rpc-market'),
      api<{ trades: Trade[] }>('/rpc-market/trades?limit=200'),
      api<{ wallet: { fiatAvailableBalance: string; rpcAvailableBalance: string } }>('/auth/me'),
    ]);
    setMarket(marketData);
    setTrades(tradesData.trades);
    setWallet(me.wallet);
    setIsLoading(false);
  }

  useEffect(() => { load().catch((err: Error) => { setError(err.message); setIsLoading(false); }); }, []);

  useEffect(() => {
    const id = setTimeout(async () => {
      if (!fiatAmount || Number(fiatAmount) < 0.01) return setBuyQuote(null);
      try {
        const quote = await api<BuyQuote>(`/rpc-market/quote-buy?fiatAmount=${encodeURIComponent(fiatAmount)}`);
        setBuyQuote(quote); setBuyQuoteError('');
      } catch (err) { setBuyQuote(null); setBuyQuoteError((err as Error).message); }
    }, 250);
    return () => clearTimeout(id);
  }, [fiatAmount]);

  useEffect(() => {
    const id = setTimeout(async () => {
      if (!rpcAmount || Number(rpcAmount) < 0.01) return setSellQuote(null);
      try {
        const quote = await api<SellQuote>(`/rpc-market/quote-sell?rpcAmount=${encodeURIComponent(rpcAmount)}`);
        setSellQuote(quote); setSellQuoteError('');
      } catch (err) { setSellQuote(null); setSellQuoteError((err as Error).message); }
    }, 250);
    return () => clearTimeout(id);
  }, [rpcAmount]);

  const filteredTrades = useMemo(() => {
    const config = timeframes.find((item) => item.key === activeTimeframe);
    if (!config?.hours) return trades;
    const minDate = Date.now() - (config.hours * 60 * 60 * 1000);
    return trades.filter((trade) => new Date(trade.createdAt).getTime() >= minDate);
  }, [activeTimeframe, trades]);

  const chart = useMemo(() => {
    const ordered = [...filteredTrades].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    const prices = ordered.map((trade) => Number(trade.priceAfter)).filter((price) => Number.isFinite(price) && price > 0);
    const fallback = Number(market?.currentPrice ?? 0);
    const allPrices = prices.length ? prices : [fallback || 1];
    const min = Math.min(...allPrices);
    const max = Math.max(...allPrices);
    const spread = Math.max(max - min, min * 0.002, 0.0001);
    const minBound = min - spread * 0.2;
    const maxBound = max + spread * 0.2;

    const points = ordered.map((trade, index) => {
      const x = ordered.length === 1 ? 80 : (index / Math.max(ordered.length - 1, 1)) * 80;
      const y = 100 - ((Number(trade.priceAfter) - minBound) / (maxBound - minBound)) * 100;
      return { x, y, trade };
    });

    return {
      points,
      min,
      max,
      last: Number(ordered[ordered.length - 1]?.priceAfter ?? fallback),
      first: Number(ordered[0]?.priceBefore ?? fallback),
      hasHistory: ordered.length > 1,
    };
  }, [filteredTrades, market?.currentPrice]);

  const variationAbs = chart.last - chart.first;
  const variationPercent = chart.first > 0 ? (variationAbs / chart.first) * 100 : 0;

  async function onBuy(event: FormEvent) { event.preventDefault(); setError(''); setMessage(''); try { const response = await api<{ message: string }>('/rpc-market/buy', { method: 'POST', body: JSON.stringify({ fiatAmount }) }); setMessage(response.message); setFiatAmount(''); setBuyQuote(null); await load(); } catch (err) { setError((err as Error).message); } }
  async function onSell(event: FormEvent) { event.preventDefault(); setError(''); setMessage(''); try { const response = await api<{ message: string }>('/rpc-market/sell', { method: 'POST', body: JSON.stringify({ rpcAmount }) }); setMessage(response.message); setRpcAmount(''); setSellQuote(null); await load(); } catch (err) { setError((err as Error).message); } }

  return (
    <section className="card market-page market-shell">
      <div className="trade-screen market-mobile-shell">
        <header className="card trade-header market-pair-header market-compact-header market-asset-header">
          <div className="market-pair-title">
            <p className="company-emoji">💴 RPC/R$</p>
            <h3 className="trade-price-big">{`R$ ${formatPrice(Number(market?.currentPrice ?? 0))}`}</h3>
            <p className={variationPercent >= 0 ? 'positive-change' : 'negative-change'}>
              {variationPercent >= 0 ? '▲' : '▼'} {formatPercent(Math.abs(variationPercent))}% ({formatSignedPrice(variationAbs)})
            </p>
          </div>
          <div className="market-stats-row market-mini-stats">
            <div className="market-mini-stat-card"><span className="market-mini-stat-label">Volume R$</span><strong>{formatCurrency(Number(market?.totalFiatVolume ?? 0))}</strong></div>
            <div className="market-mini-stat-card"><span className="market-mini-stat-label">Saldo R$</span><strong>{formatCurrency(Number(wallet?.fiatAvailableBalance ?? 0))}</strong></div>
            <div className="market-mini-stat-card"><span className="market-mini-stat-label">Saldo RPC</span><strong>{formatCurrency(Number(wallet?.rpcAvailableBalance ?? 0))}</strong></div>
            <div className="market-mini-stat-card"><span className="market-mini-stat-label">Atualizado</span><strong>{market?.updatedAt ? new Date(market.updatedAt).toLocaleString('pt-BR') : '--'}</strong></div>
          </div>
        </header>

        {error && <p className="status-message error">{error}</p>}
        {message && <p className="status-message success">{message}</p>}

        <section className="card nested-card market-price-tab market-tab-panel">
          <h4>Preço RPC/R$</h4>
          <div className="chart-timeframes">{timeframes.map((tf) => <button key={tf.key} className={activeTimeframe === tf.key ? 'quick-pill active' : 'quick-pill'} onClick={() => setActiveTimeframe(tf.key)}>{tf.label}</button>)}</div>
          <div className="chart-wrap chart-wrap-highlight modern-chart-shell market-chart-card rpc-chart-shell">
            {isLoading && <div className="chart-empty-elegant"><strong>Carregando histórico</strong><span>Buscando dados do mercado RPC/R$.</span></div>}
            {!isLoading && (
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="line-chart">
                <polyline points={chart.points.map((point) => `${point.x},${point.y}`).join(' ')} fill="none" stroke="#38bdf8" strokeWidth="2.6" vectorEffect="non-scaling-stroke" />
                {chart.points.length > 0 && <line className="current-price-line" x1="0" x2="84" y1={chart.points[chart.points.length - 1].y} y2={chart.points[chart.points.length - 1].y} />}
                {chart.points.map((point) => <circle key={point.trade.id} cx={point.x} cy={point.y} r="1.2"><title>{`${new Date(point.trade.createdAt).toLocaleString('pt-BR')} · R$ ${formatPrice(Number(point.trade.priceAfter))}`}</title></circle>)}
              </svg>
            )}
          </div>
          <div className="chart-meta market-price-card"><div><span>Último</span><strong>R$ {formatPrice(chart.last)}</strong></div><div><span>Máximo</span><strong>R$ {formatPrice(chart.max)}</strong></div><div><span>Mínimo</span><strong>R$ {formatPrice(chart.min)}</strong></div></div>
          {!isLoading && !chart.hasHistory && <div className="chart-empty-elegant"><strong>Histórico insuficiente no período</strong><span>Ainda assim o preço atual está disponível para negociação.</span></div>}
        </section>

        <section className="card nested-card market-tab-panel">
          <h4>Painel de negociação</h4>
          <div className="quick-actions">
            <button className={activeSide === 'buy' ? 'quick-pill active' : 'quick-pill'} onClick={() => setActiveSide('buy')}>Comprar RPC</button>
            <button className={activeSide === 'sell' ? 'quick-pill active' : 'quick-pill'} onClick={() => setActiveSide('sell')}>Vender RPC</button>
          </div>
          {activeSide === 'buy' ? (
            <form onSubmit={onBuy} className="form-grid nested-card buy-side">
              <input value={fiatAmount} onChange={(e) => setFiatAmount(e.target.value)} placeholder="Entrada em R$" required />
              {buyQuoteError && <p className="info-text">Não foi possível atualizar a cotação de compra: {buyQuoteError}</p>}
              <p className="info-text">Saída estimada: {`${formatCurrency(Number(buyQuote?.estimatedRpcAmount ?? 0))} RPC`}</p>
              <p className="info-text">Preço médio estimado: {`R$ ${formatPrice(Number(buyQuote?.effectiveUnitPrice ?? 0))}`}</p>
              <p className="info-text">Taxa aplicada: 0%</p>
              <p className="info-text">Total final: {`R$ ${formatCurrency(Number(fiatAmount || 0))}`}</p>
              <button className="button-success" type="submit" disabled={!buyQuote || Number(fiatAmount) < 0.01}>Comprar RPC</button>
            </form>
          ) : (
            <form onSubmit={onSell} className="form-grid nested-card sell-side">
              <input value={rpcAmount} onChange={(e) => setRpcAmount(e.target.value)} placeholder="Entrada em RPC" required />
              {sellQuoteError && <p className="info-text">Não foi possível atualizar a cotação de venda: {sellQuoteError}</p>}
              <p className="info-text">Saída estimada: {`R$ ${formatCurrency(Number(sellQuote?.estimatedFiatAmount ?? 0))}`}</p>
              <p className="info-text">Preço médio estimado: {`R$ ${formatPrice(Number(sellQuote?.effectiveUnitPrice ?? 0))}`}</p>
              <p className="info-text">Taxa aplicada: 0%</p>
              <p className="info-text">Total final: {`R$ ${formatCurrency(Number(sellQuote?.estimatedFiatAmount ?? 0))}`}</p>
              <button className="button-danger" type="submit" disabled={!sellQuote || Number(rpcAmount) < 0.01}>Vender RPC</button>
            </form>
          )}
        </section>

        <section className="card nested-card market-book-tab market-tab-panel">
          <h4>Profundidade baseada em liquidez real</h4>
          <div className="order-book-grid">
            <div className="summary-item buy-side"><span className="summary-label">Reserva RPC</span><strong>{`${formatCurrency(Number(market?.rpcReserve ?? 0))} RPC`}</strong></div>
            <div className="summary-item sell-side"><span className="summary-label">Reserva R$</span><strong>{`R$ ${formatCurrency(Number(market?.fiatReserve ?? 0))}`}</strong></div>
          </div>
        </section>

        <section className="card nested-card market-tab-panel">
          <h4>Últimos trades</h4>
          <div className="mobile-card-list">
            {trades.length === 0 && <p className="empty-state">Sem negociações ainda.</p>}
            {trades.slice(0, 20).map((trade) => (<article key={trade.id} className="summary-item compact-card market-order-card"><p><strong>{trade.side === 'BUY_RPC' ? 'COMPRA' : 'VENDA'}</strong> · {new Date(trade.createdAt).toLocaleTimeString('pt-BR')}</p><p>Preço: {`R$ ${formatPrice(Number(trade.unitPrice))}`}</p><p>Quantidade: {`${formatCurrency(Number(trade.rpcAmount))} RPC`}</p><p>Total: {`R$ ${formatCurrency(Number(trade.fiatAmount))}`}</p></article>))}
          </div>
        </section>
      </div>
    </section>
  );
}
