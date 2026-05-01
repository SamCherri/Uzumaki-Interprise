import { FormEvent, useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';
import { formatCurrency, formatPercent, formatPrice, formatSignedPrice } from '../utils/formatters';

type MarketState = { currentPrice: string; fiatReserve: string; rpcReserve: string; totalFiatVolume: string; totalRpcVolume: string; totalBuys: number; totalSells: number; updatedAt: string; };
type Trade = { id: string; side: 'BUY_RPC' | 'SELL_RPC'; fiatAmount: string; rpcAmount: string; unitPrice: string; priceBefore: string; priceAfter: string; createdAt: string; };
type BuyQuote = { estimatedRpcAmount: string; effectiveUnitPrice: string };
type SellQuote = { estimatedFiatAmount: string; effectiveUnitPrice: string };
type Timeframe = '1H' | '24H' | '7D' | '30D' | 'ALL';
type ChartPoint = {
  id: string;
  x: number;
  y: number;
  price: number;
  fiatAmount: number;
  rpcAmount: number;
  side: 'BUY_RPC' | 'SELL_RPC';
  createdAt: string;
};

const timeframes: { key: Timeframe; label: string; hours: number | null }[] = [
  { key: '1H', label: '1H', hours: 1 },
  { key: '24H', label: '24H', hours: 24 },
  { key: '7D', label: '7D', hours: 24 * 7 },
  { key: '30D', label: '30D', hours: 24 * 30 },
  { key: 'ALL', label: 'ALL', hours: null },
];
const RPC_MARKET_TRADES_LIMIT = 200;
const TRADES_LOAD_FALLBACK_MESSAGE = 'Não foi possível carregar o histórico de trades agora. O preço atual continua disponível.';
const TRADES_LIMIT_WARNING_MESSAGE = 'Limite de histórico inválido. Usando histórico reduzido.';

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

  function getFriendlyErrorMessage(err: unknown, fallback: string) {
    const message = err instanceof Error ? err.message : '';
    if (message.includes('Number must be less than or equal to 200')) return TRADES_LIMIT_WARNING_MESSAGE;
    return fallback;
  }

  async function load() {
    setIsLoading(true);
    setError('');
    try {
      const [marketData, me, tradesResult] = await Promise.all([
        api<MarketState>('/rpc-market'),
        api<{ wallet: { fiatAvailableBalance: string; rpcAvailableBalance: string } }>('/auth/me'),
        api<{ trades: Trade[] }>(`/rpc-market/trades?limit=${RPC_MARKET_TRADES_LIMIT}`)
          .then((data) => ({ ok: true as const, data }))
          .catch((err: unknown) => ({ ok: false as const, err })),
      ]);
      setMarket(marketData);
      setWallet(me.wallet);
      if (tradesResult.ok) {
        setTrades(tradesResult.data.trades);
      } else {
        setTrades([]);
        setError(getFriendlyErrorMessage(tradesResult.err, TRADES_LOAD_FALLBACK_MESSAGE));
      }
      return true;
    } catch (err) {
      setError('Não foi possível carregar os dados principais do mercado agora. Tente novamente em instantes.');
      return false;
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

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
    const currentPrice = Number(market?.currentPrice ?? 0) || 0;
    const normalized = ordered.map((trade) => ({
      ...trade,
      price: Number(trade.priceAfter || trade.unitPrice || 0),
      fiat: Number(trade.fiatAmount || 0),
      rpc: Number(trade.rpcAmount || 0),
      timestamp: new Date(trade.createdAt).getTime(),
    })).filter((trade) => Number.isFinite(trade.price) && trade.price > 0);

    const prices = normalized.map((item) => item.price);
    const basePrice = currentPrice > 0 ? currentPrice : (prices[0] ?? 1);
    const first = prices[0] ?? basePrice;
    const last = prices[prices.length - 1] ?? basePrice;
    const pricesWithReference = [...prices, basePrice];
    const rawMin = Math.min(...pricesWithReference);
    const rawMax = Math.max(...pricesWithReference);
    const spread = Math.max(rawMax - rawMin, Math.max(rawMin, basePrice) * 0.004, 0.01);
    const minBound = Math.max(0.0001, rawMin - spread * 0.4);
    const maxBound = rawMax + spread * 0.4;
    const chartHeight = 78;
    const chartBottom = 88;

    const timestampStart = normalized[0]?.timestamp ?? Date.now();
    const timestampEnd = normalized[normalized.length - 1]?.timestamp ?? timestampStart + 1;
    const range = Math.max(1, timestampEnd - timestampStart);
    const xByIndex = (index: number, size: number) => (size <= 1 ? 50 : 6 + (index / (size - 1)) * 88);
    const xByTime = (ts: number) => 6 + (((ts - timestampStart) / range) * 88);
    const yFor = (price: number) => chartBottom - (((price - minBound) / Math.max(maxBound - minBound, 0.0001)) * chartHeight);

    const points: ChartPoint[] = normalized.map((trade, index) => ({
      id: trade.id,
      x: Number.isFinite(trade.timestamp) ? xByTime(trade.timestamp) : xByIndex(index, normalized.length),
      y: yFor(trade.price),
      price: trade.price,
      fiatAmount: trade.fiat,
      rpcAmount: trade.rpc,
      side: trade.side,
      createdAt: trade.createdAt,
    }));

    const linePoints = points.map((point) => `${point.x},${point.y}`).join(' ');
    const areaPoints = points.length ? `6,88 ${linePoints} 94,88` : '';
    const fiatVolume = normalized.reduce((acc, trade) => acc + trade.fiat, 0);
    const rpcVolume = normalized.reduce((acc, trade) => acc + trade.rpc, 0);
    const hasEnoughHistory = points.length >= 2;
    const emptyReason = points.length === 0 ? 'Ainda não há negociações neste período.' : points.length === 1 ? 'Histórico insuficiente neste período' : undefined;

    return {
      points,
      linePoints,
      areaPoints,
      min: rawMin,
      max: rawMax,
      first,
      last,
      variationAbs: last - first,
      variationPercent: first > 0 ? ((last - first) / first) * 100 : 0,
      tradeCount: points.length,
      fiatVolume,
      rpcVolume,
      hasEnoughHistory,
      emptyReason,
      currentY: yFor(basePrice),
      activityBars: points.slice(-40),
    };
  }, [filteredTrades, market?.currentPrice]);

  const variationAbs = chart.variationAbs;
  const variationPercent = chart.variationPercent;

  async function onBuy(event: FormEvent) {
    event.preventDefault();
    setError('');
    setMessage('');
    try {
      const response = await api<{ message: string }>('/rpc-market/buy', { method: 'POST', body: JSON.stringify({ fiatAmount }) });
      setMessage(response.message);
      setFiatAmount('');
      setBuyQuote(null);
      const refreshed = await load();
      if (!refreshed) setError((prev) => prev || 'Compra concluída, mas não foi possível atualizar os dados do mercado.');
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function onSell(event: FormEvent) {
    event.preventDefault();
    setError('');
    setMessage('');
    try {
      const response = await api<{ message: string }>('/rpc-market/sell', { method: 'POST', body: JSON.stringify({ rpcAmount }) });
      setMessage(response.message);
      setRpcAmount('');
      setSellQuote(null);
      const refreshed = await load();
      if (!refreshed) setError((prev) => prev || 'Venda concluída, mas não foi possível atualizar os dados do mercado.');
    } catch (err) {
      setError((err as Error).message);
    }
  }

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
          <p className="chart-period-summary">Período: {activeTimeframe}</p>
          <div className="chart-wrap chart-wrap-highlight modern-chart-shell market-chart-card rpc-chart-shell">
            {isLoading && <div className="chart-empty-elegant"><strong>Carregando histórico</strong><span>Buscando dados do mercado RPC/R$.</span></div>}
            {!isLoading && (
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" className={`line-chart ${variationPercent >= 0 ? 'positive-chart' : 'negative-chart'}`}>
                <defs>
                  <linearGradient id="chartAreaGradient" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="currentColor" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="currentColor" stopOpacity="0.02" />
                  </linearGradient>
                </defs>
                {[20, 36, 52, 68, 84].map((lineY) => <line key={lineY} className="chart-grid-line" x1="6" x2="94" y1={lineY} y2={lineY} />)}
                <line className="current-price-line" x1="6" x2="94" y1={chart.currentY} y2={chart.currentY} />
                {chart.tradeCount >= 2 && <polygon className="chart-area-fill" points={chart.areaPoints} />}
                {chart.tradeCount >= 2 && <polyline className="chart-main-line" points={chart.linePoints} fill="none" vectorEffect="non-scaling-stroke" />}
                {chart.tradeCount <= 1 && <line className="chart-main-line" x1="6" x2="94" y1={chart.tradeCount === 1 ? chart.points[0].y : chart.currentY} y2={chart.tradeCount === 1 ? chart.points[0].y : chart.currentY} vectorEffect="non-scaling-stroke" />}
                {chart.points.map((point) => <circle key={point.id} className={point.side === 'BUY_RPC' ? 'buy-point' : 'sell-point'} cx={point.x} cy={point.y} r={chart.tradeCount === 1 ? '2.5' : '1.4'}><title>{`${new Date(point.createdAt).toLocaleString('pt-BR')} · ${point.side === 'BUY_RPC' ? 'COMPRA' : 'VENDA'} · Preço: R$ ${formatPrice(point.price)} · RPC: ${formatCurrency(point.rpcAmount)} · Total: R$ ${formatCurrency(point.fiatAmount)}`}</title></circle>)}
              </svg>
            )}
          </div>
          <div className="chart-meta market-price-card"><div><span>Trades</span><strong>{chart.tradeCount}</strong></div><div><span>Volume R$</span><strong>{formatCurrency(chart.fiatVolume)}</strong></div><div><span>Volume RPC</span><strong>{formatCurrency(chart.rpcVolume)}</strong></div><div><span>Último</span><strong>R$ {formatPrice(chart.last)}</strong></div><div><span>Máximo</span><strong>R$ {formatPrice(chart.max)}</strong></div><div><span>Mínimo</span><strong>R$ {formatPrice(chart.min)}</strong></div></div>
          <div className="volume-mini-chart">{chart.activityBars.length > 0 && <div className="volume-bars">{chart.activityBars.map((bar) => <div key={bar.id} className={bar.side === 'BUY_RPC' ? 'buy-point' : 'sell-point'} style={{ height: `${Math.max(12, (bar.fiatAmount / Math.max(chart.fiatVolume, 1)) * 150)}px` }} />)}</div>}</div>
          {!isLoading && chart.emptyReason && <div className="chart-empty-elegant"><strong>{chart.emptyReason === 'Ainda não há negociações neste período.' ? 'Histórico insuficiente neste período' : chart.emptyReason}</strong><span>{chart.emptyReason}</span></div>}
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
