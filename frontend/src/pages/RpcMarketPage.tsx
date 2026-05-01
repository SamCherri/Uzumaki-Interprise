import { FormEvent, useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';
import { formatCurrency, formatPercent, formatPrice, formatSignedPrice } from '../utils/formatters';

type MarketState = { currentPrice: string; fiatReserve: string; rpcReserve: string; totalFiatVolume: string; totalRpcVolume: string; totalBuys: number; totalSells: number; updatedAt: string; };
type Trade = { id: string; side: 'BUY_RPC' | 'SELL_RPC'; fiatAmount: string; rpcAmount: string; unitPrice: string; priceBefore: string; priceAfter: string; createdAt: string; };
type BuyQuote = { estimatedRpcAmount: string; effectiveUnitPrice: string };
type SellQuote = { estimatedFiatAmount: string; effectiveUnitPrice: string };
type LimitOrder = { id: string; side: 'BUY_RPC' | 'SELL_RPC'; status: 'OPEN' | 'FILLED' | 'CANCELED' | 'REJECTED'; limitPrice: string; fiatAmount?: string; rpcAmount?: string; lockedFiatAmount: string; lockedRpcAmount: string; createdAt: string; executedAt?: string; canceledAt?: string };
type OrderBook = { buyOrders: LimitOrder[]; sellOrders: LimitOrder[] };
type Timeframe = '1H' | '24H' | '7D' | '30D' | 'ALL';
type RpcMarketTab = 'preco' | 'livro' | 'ordens' | 'trades' | 'dados';
type TradeFlow = 'buy' | 'sell' | null;
type RpcTradeMode = 'market' | 'limit';
type ChartPoint = { id: string; x: number; y: number; price: number; fiatAmount: number; rpcAmount: number; side: 'BUY_RPC' | 'SELL_RPC'; createdAt: string; };

const timeframes: { key: Timeframe; label: string; hours: number | null }[] = [
  { key: '1H', label: '1H', hours: 1 },
  { key: '24H', label: '24H', hours: 24 },
  { key: '7D', label: '7D', hours: 24 * 7 },
  { key: '30D', label: '30D', hours: 24 * 30 },
  { key: 'ALL', label: 'ALL', hours: null },
];

const RPC_MARKET_TRADES_LIMIT = 200;
const TRADES_LOAD_FALLBACK_MESSAGE = 'Não foi possível carregar o histórico de trades agora. O preço atual continua disponível.';

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
  const [activeTab, setActiveTab] = useState<RpcMarketTab>('preco');
  const [tradeFlow, setTradeFlow] = useState<TradeFlow>(null);
  const [activeTimeframe, setActiveTimeframe] = useState<Timeframe>('24H');
  const [orderBook, setOrderBook] = useState<OrderBook>({ buyOrders: [], sellOrders: [] });
  const [myOrders, setMyOrders] = useState<LimitOrder[]>([]);
  const [tradeMode, setTradeMode] = useState<RpcTradeMode>('market');
  const [limitFiatAmount, setLimitFiatAmount] = useState('');
  const [limitRpcAmount, setLimitRpcAmount] = useState('');
  const [limitPrice, setLimitPrice] = useState('');
  const [favorite, setFavorite] = useState<boolean>(() => localStorage.getItem('rpc-exchange-rpc-market-favorite') === '1');

  async function load() {
    setIsLoading(true);
    setError('');
    try {
      const [marketData, me, tradesResult, orderBookData, myOrdersData] = await Promise.all([
        api<MarketState>('/rpc-market'),
        api<{ wallet: { fiatAvailableBalance: string; rpcAvailableBalance: string } }>('/auth/me'),
        api<{ trades: Trade[] }>(`/rpc-market/trades?limit=${RPC_MARKET_TRADES_LIMIT}`)
          .then((data) => ({ ok: true as const, data }))
          .catch(() => ({ ok: false as const })),
        api<OrderBook>('/rpc-market/order-book'),
        api<{ orders: LimitOrder[] }>('/rpc-market/orders/me'),
      ]);
      setMarket(marketData);
      setWallet(me.wallet as any);
      setOrderBook(orderBookData);
      setMyOrders(myOrdersData.orders);
      if (tradesResult.ok) {
        setTrades(tradesResult.data.trades);
      } else {
        setTrades([]);
        setError(TRADES_LOAD_FALLBACK_MESSAGE);
      }
      return true;
    } catch {
      setError('Não foi possível carregar os dados principais do mercado RPC/R$ agora.');
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
        setBuyQuote(quote);
        setBuyQuoteError('');
      } catch (err) {
        setBuyQuote(null);
        setBuyQuoteError((err as Error).message);
      }
    }, 250);
    return () => clearTimeout(id);
  }, [fiatAmount]);

  useEffect(() => {
    const id = setTimeout(async () => {
      if (!rpcAmount || Number(rpcAmount) < 0.01) return setSellQuote(null);
      try {
        const quote = await api<SellQuote>(`/rpc-market/quote-sell?rpcAmount=${encodeURIComponent(rpcAmount)}`);
        setSellQuote(quote);
        setSellQuoteError('');
      } catch (err) {
        setSellQuote(null);
        setSellQuoteError((err as Error).message);
      }
    }, 250);
    return () => clearTimeout(id);
  }, [rpcAmount]);

  const filteredTrades = useMemo(() => {
    const config = timeframes.find((item) => item.key === activeTimeframe);
    if (!config?.hours) return trades;
    const minDate = Date.now() - config.hours * 60 * 60 * 1000;
    return trades.filter((trade) => new Date(trade.createdAt).getTime() >= minDate);
  }, [activeTimeframe, trades]);

  const chart = useMemo(() => {
    const ordered = [...filteredTrades].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    const currentPrice = Number(market?.currentPrice ?? 0) || 0;
    const normalized = ordered
      .map((trade) => ({ ...trade, price: Number(trade.priceAfter || trade.unitPrice || 0), fiat: Number(trade.fiatAmount || 0), rpc: Number(trade.rpcAmount || 0), timestamp: new Date(trade.createdAt).getTime() }))
      .filter((trade) => Number.isFinite(trade.price) && trade.price > 0);

    const prices = normalized.map((item) => item.price);
    const basePrice = currentPrice > 0 ? currentPrice : prices[0] ?? 1;
    const first = prices[0] ?? basePrice;
    const last = prices[prices.length - 1] ?? basePrice;
    const pricesWithReference = [...prices, basePrice];
    const rawMin = Math.min(...pricesWithReference);
    const rawMax = Math.max(...pricesWithReference);
    const spread = Math.max(rawMax - rawMin, Math.max(rawMin, basePrice) * 0.004, 0.01);
    const minBound = Math.max(0.0001, rawMin - spread * 0.4);
    const maxBound = rawMax + spread * 0.4;

    const timestampStart = normalized[0]?.timestamp ?? Date.now();
    const timestampEnd = normalized[normalized.length - 1]?.timestamp ?? timestampStart + 1;
    const range = Math.max(1, timestampEnd - timestampStart);
    const yFor = (price: number) => 88 - ((price - minBound) / Math.max(maxBound - minBound, 0.0001)) * 78;

    const points: ChartPoint[] = normalized.map((trade, index) => ({
      id: trade.id,
      x: Number.isFinite(trade.timestamp) ? 6 + ((trade.timestamp - timestampStart) / range) * 88 : 6 + (index / Math.max(1, normalized.length - 1)) * 88,
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
      currentY: yFor(basePrice),
      emptyReason: points.length === 0 ? 'Ainda não há negociações neste período.' : points.length === 1 ? 'Histórico insuficiente neste período.' : undefined,
      activityBars: points.slice(-40),
    };
  }, [filteredTrades, market?.currentPrice]);

  async function onBuy(event: FormEvent) {
    event.preventDefault();
    setError('');
    setMessage('');
    try {
      const response = await api<{ message: string }>('/rpc-market/buy', { method: 'POST', body: JSON.stringify({ fiatAmount }) });
      setMessage(response.message);
      setFiatAmount('');
      setBuyQuote(null);
      setTradeFlow(null);
      await load();
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
      setTradeFlow(null);
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const variationAbs = chart.variationAbs;
  const variationPercent = chart.variationPercent;

  return (
    <section className="card market-page market-shell market-page-v2">
      <div className="trade-screen market-mobile-shell">
        <header className="card trade-header market-pair-header market-compact-header market-asset-header market-full-width">
          <div className="market-compact-top">
                        <p className="company-emoji">💴 RPC/R$</p>
            <span className="summary-label">Ativo</span>
            <button type="button" className="small-button" onClick={() => { const v=!favorite; setFavorite(v); localStorage.setItem('rpc-exchange-rpc-market-favorite', v ? '1' : '0'); }}>{favorite ? "★" : "☆"}</button>
          </div>
          <div className="market-price-overview">
            <h3 className="trade-price-big">R$ {formatPrice(Number(market?.currentPrice ?? 0))}</h3>
            <p className={variationPercent >= 0 ? 'positive-change' : 'negative-change'}>
              {variationPercent >= 0 ? '▲' : '▼'} {formatPercent(Math.abs(variationPercent))}% ({formatSignedPrice(variationAbs)})
            </p>
          </div>
          <div className="market-stats-row market-mini-stats">
            <div className="market-mini-stat-card"><span className="market-mini-stat-label">Máx</span><strong>R$ {formatPrice(chart.max)}</strong></div>
            <div className="market-mini-stat-card"><span className="market-mini-stat-label">Mín</span><strong>R$ {formatPrice(chart.min)}</strong></div>
            <div className="market-mini-stat-card"><span className="market-mini-stat-label">Volume</span><strong>R$ {formatCurrency(chart.fiatVolume)}</strong></div>
            <div className="market-mini-stat-card"><span className="market-mini-stat-label">Saldo RPC</span><strong>{formatCurrency(Number(wallet?.rpcAvailableBalance ?? 0))}</strong></div>
          </div>
        </header>

        {error && <p className="status-message error market-full-width">{error}</p>}
        {message && <p className="status-message success market-full-width">{message}</p>}

        <nav className="market-top-tabs market-mobile-tabs market-full-width">
          <button className={activeTab === 'preco' ? 'quick-pill active' : 'quick-pill'} onClick={() => setActiveTab('preco')}>Preço</button>
          <button className={activeTab === 'livro' ? 'quick-pill active' : 'quick-pill'} onClick={() => setActiveTab('livro')}>Livro</button>
          <button className={activeTab === 'ordens' ? 'quick-pill active' : 'quick-pill'} onClick={() => setActiveTab('ordens')}>Ordens</button>
          <button className={activeTab === 'trades' ? 'quick-pill active' : 'quick-pill'} onClick={() => setActiveTab('trades')}>Trades</button>
          <button className={activeTab === 'dados' ? 'quick-pill active' : 'quick-pill'} onClick={() => setActiveTab('dados')}>Dados</button>
        </nav>

        {activeTab === 'preco' && <section className="card nested-card market-price-tab market-tab-panel market-full-width">
          <h4>Preço RPC/R$</h4>
          <div className="chart-timeframes">{timeframes.map((tf) => <button key={tf.key} className={activeTimeframe === tf.key ? 'quick-pill active' : 'quick-pill'} onClick={() => setActiveTimeframe(tf.key)}>{tf.label}</button>)}</div>
          <div className="chart-wrap chart-wrap-highlight modern-chart-shell market-chart-card rpc-chart-shell">
            {isLoading && <div className="chart-empty-elegant"><strong>Carregando histórico</strong><span>Buscando dados do mercado RPC/R$.</span></div>}
            {!isLoading && <svg viewBox="0 0 100 100" preserveAspectRatio="none" className={`line-chart ${variationPercent >= 0 ? 'positive-chart' : 'negative-chart'}`}>
              {[20, 36, 52, 68, 84].map((lineY) => <line key={lineY} className="chart-grid-line" x1="6" x2="94" y1={lineY} y2={lineY} />)}
              <line className="current-price-line" x1="6" x2="94" y1={chart.currentY} y2={chart.currentY} />
              {chart.tradeCount >= 2 && <polygon className="chart-area-fill" points={chart.areaPoints} />}
              {chart.tradeCount >= 2 && <polyline className="chart-main-line" points={chart.linePoints} fill="none" vectorEffect="non-scaling-stroke" />}
              {chart.tradeCount <= 1 && <line className="chart-main-line" x1="6" x2="94" y1={chart.tradeCount === 1 ? chart.points[0].y : chart.currentY} y2={chart.tradeCount === 1 ? chart.points[0].y : chart.currentY} vectorEffect="non-scaling-stroke" />}
            </svg>}
          </div>
          <div className="chart-meta market-price-card"><div><span>Atual</span><strong>R$ {formatPrice(Number(market?.currentPrice ?? 0))}</strong></div><div><span>Máximo</span><strong>R$ {formatPrice(chart.max)}</strong></div><div><span>Mínimo</span><strong>R$ {formatPrice(chart.min)}</strong></div><div><span>Volume R$</span><strong>{formatCurrency(chart.fiatVolume)}</strong></div><div><span>Volume RPC</span><strong>{formatCurrency(chart.rpcVolume)}</strong></div><div><span>Trades no período</span><strong>{chart.tradeCount}</strong></div></div>
          {!isLoading && chart.emptyReason && <p className="empty-state">{chart.emptyReason}</p>}
        </section>}

        {activeTab === 'livro' && <section className="card nested-card market-tab-panel market-full-width"><h4>Livro de ordens RPC/R$</h4><p className="info-text">RPC/R$ ainda usa liquidez automática para execução. O livro mostra ordens limite pendentes.</p><div className="order-book-grid"><div className="summary-item"><span className="summary-label">Reserva RPC</span><strong>{formatCurrency(Number(market?.rpcReserve ?? 0))} RPC</strong></div><div className="summary-item"><span className="summary-label">Reserva R$</span><strong>R$ {formatCurrency(Number(market?.fiatReserve ?? 0))}</strong></div><div className="summary-item"><span className="summary-label">Preço atual</span><strong>R$ {formatPrice(Number(market?.currentPrice ?? 0))}</strong></div></div><h5>Compras</h5>{orderBook.buyOrders.length===0?<p className="empty-state">Sem ordens abertas neste lado.</p>:orderBook.buyOrders.map((o)=><article key={o.id} className="summary-item compact-card market-order-card"><p>Preço limite: R$ {formatPrice(Number(o.limitPrice))}</p><p>Valor R$: {formatCurrency(Number(o.lockedFiatAmount||o.fiatAmount||0))}</p><p>Criada: {new Date(o.createdAt).toLocaleString('pt-BR')}</p></article>)}<h5>Vendas</h5>{orderBook.sellOrders.length===0?<p className="empty-state">Sem ordens abertas neste lado.</p>:orderBook.sellOrders.map((o)=><article key={o.id} className="summary-item compact-card market-order-card"><p>Preço limite: R$ {formatPrice(Number(o.limitPrice))}</p><p>Valor RPC: {formatCurrency(Number(o.lockedRpcAmount||o.rpcAmount||0))}</p><p>Criada: {new Date(o.createdAt).toLocaleString('pt-BR')}</p></article>)}</section>}

        {activeTab === 'ordens' && <section className="card nested-card market-tab-panel market-full-width"><h4>Ordem limite em breve</h4><p className="info-text">Ordens limite para RPC/R$ em breve. No momento, as compras e vendas são executadas imediatamente pelo preço estimado.</p><p className="info-text">Execução imediata · Preço pode variar conforme liquidez.</p></section>}

        {activeTab === 'trades' && <section className="card nested-card market-tab-panel market-full-width"><h4>Últimos trades RPC/R$</h4><div className="mobile-card-list">{trades.length === 0 && <p className="empty-state">Sem negociações ainda.</p>}{trades.slice(0, 20).map((trade) => <article key={trade.id} className="summary-item compact-card market-order-card"><p><strong>{trade.side === 'BUY_RPC' ? 'COMPRA' : 'VENDA'}</strong> · {new Date(trade.createdAt).toLocaleTimeString('pt-BR')}</p><p>Preço: R$ {formatPrice(Number(trade.unitPrice))}</p><p>Quantidade: {formatCurrency(Number(trade.rpcAmount))} RPC</p><p>Total: R$ {formatCurrency(Number(trade.fiatAmount))}</p></article>)}</div></section>}

        {activeTab === 'dados' && <section className="card nested-card market-tab-panel market-full-width"><h4>Dados do mercado</h4><div className="market-data-grid"><div className="summary-item"><span className="summary-label">Preço atual</span><strong>R$ {formatPrice(Number(market?.currentPrice ?? 0))}</strong></div><div className="summary-item"><span className="summary-label">Reserva RPC</span><strong>{formatCurrency(Number(market?.rpcReserve ?? 0))} RPC</strong></div><div className="summary-item"><span className="summary-label">Reserva R$</span><strong>R$ {formatCurrency(Number(market?.fiatReserve ?? 0))}</strong></div><div className="summary-item"><span className="summary-label">Volume total R$</span><strong>{formatCurrency(Number(market?.totalFiatVolume ?? 0))}</strong></div><div className="summary-item"><span className="summary-label">Volume total RPC</span><strong>{formatCurrency(Number(market?.totalRpcVolume ?? 0))}</strong></div><div className="summary-item"><span className="summary-label">Total compras</span><strong>{market?.totalBuys ?? 0}</strong></div><div className="summary-item"><span className="summary-label">Total vendas</span><strong>{market?.totalSells ?? 0}</strong></div><div className="summary-item"><span className="summary-label">Atualizado em</span><strong>{market?.updatedAt ? new Date(market.updatedAt).toLocaleString('pt-BR') : '--'}</strong></div><div className="summary-item"><span className="summary-label">Saldo R$</span><strong>{formatCurrency(Number(wallet?.fiatAvailableBalance ?? 0))}</strong></div><div className="summary-item"><span className="summary-label">Saldo RPC</span><strong>{formatCurrency(Number(wallet?.rpcAvailableBalance ?? 0))}</strong></div></div></section>}

        <div className="mobile-trade-actions"><button className="button-success" type="button" onClick={() => setTradeFlow('buy')}>Comprar</button><button className="button-danger" type="button" onClick={() => setTradeFlow('sell')}>Vender</button></div>

        {tradeFlow && <div className="trade-panel-backdrop" onClick={() => setTradeFlow(null)}><div className="trade-bottom-sheet market-trade-sheet" onClick={(event) => event.stopPropagation()}><div className="market-sheet-handle" aria-hidden="true" /><div className="trade-panel-header"><h4>{tradeFlow === 'buy' ? 'Comprar RPC' : 'Vender RPC'}</h4><button type="button" className="small-button" onClick={() => setTradeFlow(null)}>Fechar</button></div>
          {tradeFlow === 'buy' ? <form onSubmit={onBuy}><p className="market-sheet-balance-row">Saldo R$ disponível: {formatCurrency(Number(wallet?.fiatAvailableBalance ?? 0))}</p><input value={fiatAmount} onChange={(e) => setFiatAmount(e.target.value)} placeholder="Entrada em R$" required /><div className="market-sheet-mini-card"><p>Saída estimada em RPC: {formatCurrency(Number(buyQuote?.estimatedRpcAmount ?? 0))}</p><p>Preço médio estimado: R$ {formatPrice(Number(buyQuote?.effectiveUnitPrice ?? 0))}</p><p>Taxa aplicada: 0%</p><p>Total final: R$ {formatCurrency(Number(fiatAmount || 0))}</p></div>{buyQuoteError && <p className="info-text">{buyQuoteError}</p>}<button className="button-success" type="submit" disabled={!buyQuote || Number(fiatAmount) < 0.01}>Comprar agora</button></form> : <form onSubmit={onSell}><p className="market-sheet-balance-row">Saldo RPC disponível: {formatCurrency(Number(wallet?.rpcAvailableBalance ?? 0))}</p><input value={rpcAmount} onChange={(e) => setRpcAmount(e.target.value)} placeholder="Entrada em RPC" required /><div className="market-sheet-mini-card"><p>Saída estimada em R$: {formatCurrency(Number(sellQuote?.estimatedFiatAmount ?? 0))}</p><p>Preço médio estimado: R$ {formatPrice(Number(sellQuote?.effectiveUnitPrice ?? 0))}</p><p>Taxa aplicada: 0%</p><p>Total final: R$ {formatCurrency(Number(sellQuote?.estimatedFiatAmount ?? 0))}</p></div>{sellQuoteError && <p className="info-text">{sellQuoteError}</p>}<button className="button-danger" type="submit" disabled={!sellQuote || Number(rpcAmount) < 0.01}>Vender agora</button></form>}
        </div></div>}
      </div>
    </section>
  );
}
