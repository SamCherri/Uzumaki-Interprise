import { FormEvent, useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';
import { formatCurrency, formatPercent, formatPrice, formatSignedPrice } from '../utils/formatters';
import { translateCompanyStatus, translateOrderMode, translateOrderStatus, translateOrderType } from '../utils/labels';

type Company = {
  id: string;
  name: string;
  ticker: string;
  sector: string;
  description: string;
  initialPrice: string;
  currentPrice: string;
  availableOfferShares: number;
  totalShares: number;
  ownerSharePercent: string;
  publicOfferPercent: string;
  buyFeePercent: string;
  sellFeePercent: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'CLOSED' | 'REJECTED' | 'BANKRUPT' | 'PENDING';
};

type Holding = { companyId: string; quantity: number };

type MarketOrder = {
  id: string;
  companyId: string;
  type: 'BUY' | 'SELL';
  mode: 'LIMIT' | 'MARKET';
  quantity: number;
  remainingQuantity: number;
  limitPrice: string | null;
  status: 'OPEN' | 'PARTIALLY_FILLED' | 'FILLED' | 'CANCELED' | 'REJECTED';
  createdAt: string;
};

type Trade = { id: string; quantity: number; unitPrice: string; createdAt: string };
type DetailTab = 'preco' | 'info' | 'dados' | 'ordens' | 'historico';
type MarketListTab = 'mercado' | 'destaques';
type TradeFlow = 'buy' | 'sell' | null;
type BuyMode = 'initial' | 'limit' | 'market';
type SellMode = 'limit' | 'market';


type InitialOfferBuyResponse = {
  priceBefore?: string | number;
  priceAfter?: string | number;
  priceIncrease?: string | number;
  currentPrice?: string | number;
};

type ChartData = {
  points: Array<{ x: number; y: number; price: number }>;
  minPrice: number;
  maxPrice: number;
  initialPrice: number;
  currentPrice: number;
  variationAbsolute: number;
  variationPercent: number;
  lastPrice: number;
  note: string;
};

function buildPriceTicks(min: number, max: number, count = 5) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [];
  if (min === max) {
    const padding = Math.max(min * 0.01, 0.01);
    min -= padding;
    max += padding;
  }
  const step = (max - min) / (count - 1);
  return Array.from({ length: count }, (_, index) => max - step * index);
}

function getBookVolumeWeight(order: MarketOrder, maxVolume: number) {
  if (maxVolume <= 0) return 0;
  return Math.max(8, Math.round((order.remainingQuantity / maxVolume) * 100));
}


function getPriceChangePercent(company: Company) {
  const initial = Number(company.initialPrice);
  const current = Number(company.currentPrice);
  if (!Number.isFinite(initial) || initial <= 0 || !Number.isFinite(current)) return 0;
  return ((current - initial) / initial) * 100;
}

function normalizeChartData(trades: Trade[], initialPrice: number, currentPrice: number): ChartData {
  const ordered = [...trades].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const prices = ordered.map((trade) => Number(trade.unitPrice)).filter((price) => Number.isFinite(price) && price > 0);

  const safeInitialPrice = Number.isFinite(initialPrice) && initialPrice > 0 ? initialPrice : 1;
  const safeCurrentPrice = Number.isFinite(currentPrice) && currentPrice > 0 ? currentPrice : safeInitialPrice;
  const series: number[] = [safeInitialPrice, ...prices];
  const lastSeriesPrice = series[series.length - 1];

  if (lastSeriesPrice !== safeCurrentPrice) {
    series.push(safeCurrentPrice);
  }

  if (series.length === 1) {
    series.push(series[0]);
  }

  const note =
    trades.length === 0
      ? 'Ainda sem trades. O gráfico usa preço inicial e preço atual como referência.'
      : 'Compras no lançamento, trades executados e impulsões podem alterar o preço atual.';

  const minPrice = Math.min(...series);
  const maxPrice = Math.max(...series);
  const range = maxPrice - minPrice;
  const hasRange = range !== 0;
  const minimalPadding = Math.max(safeCurrentPrice * 0.01, 0.01);
  const padding = hasRange ? Math.max(range * 0.2, minimalPadding) : minimalPadding;
  const chartMin = minPrice - padding;
  const chartMax = maxPrice + padding;
  const chartRange = chartMax - chartMin;

  const variationAbsolute = safeCurrentPrice - safeInitialPrice;
  const variationPercent = safeInitialPrice === 0 ? 0 : (variationAbsolute / safeInitialPrice) * 100;

  const points = series.map((price, index) => ({
    x: series.length === 1 ? 0 : (index / (series.length - 1)) * 100,
    y: !hasRange || chartRange === 0 ? 50 : 100 - ((price - chartMin) / chartRange) * 100,
    price,
  }));

  return { points, minPrice, maxPrice, initialPrice: safeInitialPrice, currentPrice: safeCurrentPrice, variationAbsolute, variationPercent, lastPrice: series[series.length - 1], note };
}

export function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selected, setSelected] = useState<Company | null>(null);
  const [walletBalance, setWalletBalance] = useState(0);
  const [holdingQty, setHoldingQty] = useState(0);
  const [book, setBook] = useState<{ buyOrders: MarketOrder[]; sellOrders: MarketOrder[] }>({ buyOrders: [], sellOrders: [] });
  const [myOrders, setMyOrders] = useState<MarketOrder[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);

  const [activeTab, setActiveTab] = useState<DetailTab>('preco');
  const [marketListTab, setMarketListTab] = useState<MarketListTab>('mercado');
  const [search, setSearch] = useState('');
  const [tradeFlow, setTradeFlow] = useState<TradeFlow>(null);
  const [buyMode, setBuyMode] = useState<BuyMode>('initial');
  const [sellMode, setSellMode] = useState<SellMode>('limit');

  const [initialQty, setInitialQty] = useState('');
  const [limitQty, setLimitQty] = useState('');
  const [limitPrice, setLimitPrice] = useState('');
  const [marketBuyQty, setMarketBuyQty] = useState('');
  const [marketSellQty, setMarketSellQty] = useState('');
  const [marketBuySlip, setMarketBuySlip] = useState('5');
  const [marketSellSlip, setMarketSellSlip] = useState('5');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [activeIndicator, setActiveIndicator] = useState<'MA' | 'EMA' | 'BOLL' | 'VOL' | 'MACD' | 'RSI'>('VOL');

  async function loadCompanies() {
    const response = await api<{ companies: Omit<Company, 'description'>[] }>('/companies');
    setCompanies(response.companies.filter((company) => company.status === 'ACTIVE').map((item) => ({ ...item, description: '' })));
  }

  async function loadWalletAndHolding(companyId?: string) {
    const response = await api<{ wallet: { availableBalance: string }; holdings: Holding[] }>('/me/holdings');
    setWalletBalance(Number(response.wallet.availableBalance));
    setHoldingQty(response.holdings.find((h) => h.companyId === companyId)?.quantity ?? 0);
  }

  async function loadCompanyDetails(companyId: string) {
    const response = await api<{ company: Company }>(`/companies/${companyId}`);
    setSelected(response.company);
  }

  async function loadMarket(companyId: string) {
    try {
      const [orderBook, my, lastTrades] = await Promise.all([
        api<{ buyOrders: MarketOrder[]; sellOrders: MarketOrder[] }>(`/market/companies/${companyId}/order-book`),
        api<{ orders: MarketOrder[] }>('/market/orders/me'),
        api<{ trades: Trade[] }>(`/market/companies/${companyId}/trades`),
      ]);
      setBook(orderBook);
      setMyOrders(my.orders.filter((order) => order.companyId === companyId));
      setTrades(lastTrades.trades);
    } catch (err) {
      const message = (err as Error).message;
      if (message.includes('Mercado não disponível')) {
        setSelected(null);
        setBook({ buyOrders: [], sellOrders: [] });
        setTrades([]);
        setMyOrders([]);
        setTradeFlow(null);
        setError('Este mercado não está mais disponível.');
        return;
      }
      throw err;
    }
  }



  async function refreshSelected(companyId?: string) {
    if (!companyId) return;
    await Promise.all([loadCompanyDetails(companyId), loadWalletAndHolding(companyId)]);
  }

  useEffect(() => {
    (async () => {
      try {
        await loadCompanies();
        await loadWalletAndHolding();
      } catch (err) {
        setError((err as Error).message);
      }
    })();
  }, []);


  useEffect(() => {
    if (!selected) return;
    loadMarket(selected.id).catch((err) => setError((err as Error).message));
  }, [selected?.id]);

  async function selectCompany(id: string) {
    try {
      setError('');
      setMessage('');
      setTradeFlow(null);
      setActiveTab('preco');
      await refreshSelected(id);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function buyInitialOffer(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    try {
      if (selected.status !== 'ACTIVE') throw new Error('Mercado pausado. Não é possível comprar no lançamento inicial.');
      const response = await api<InitialOfferBuyResponse>(`/companies/${selected.id}/buy-initial-offer`, {
        method: 'POST',
        body: JSON.stringify({ quantity: Number(initialQty) }),
      });
      setInitialQty('');

      const priceBefore = Number(response.priceBefore);
      const priceAfter = Number(response.priceAfter);
      const priceIncrease = Number(response.priceIncrease);

      if (Number.isFinite(priceBefore) && Number.isFinite(priceAfter)) {
        let successMessage = `Compra concluída. Preço: ${formatPrice(priceBefore)} RPC → ${formatPrice(priceAfter)} RPC.`;
        if (Number.isFinite(priceIncrease) && priceIncrease > 0) {
          successMessage += ` Variação: +${formatPrice(priceIncrease)} RPC.`;
        }
        setMessage(successMessage);
      } else {
        setMessage('Compra concluída. O preço atual foi atualizado.');
      }

      setError('');
      await Promise.all([refreshSelected(selected.id), loadCompanies(), loadMarket(selected.id)]);
    } catch (err) {
      setError(`Não foi possível comprar tokens: ${(err as Error).message}`);
    }
  }

  async function createLimitOrder(type: 'BUY' | 'SELL', event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    try {
      if (selected.status !== 'ACTIVE') throw new Error('Mercado pausado. Não é possível criar ordens.');
      await api('/market/orders', {
        method: 'POST',
        body: JSON.stringify({ companyId: selected.id, type, mode: 'LIMIT', quantity: Number(limitQty), limitPrice: Number(limitPrice) }),
      });
      setLimitQty('');
      setLimitPrice('');
      setMessage(type === 'BUY' ? 'Ordem de compra criada no livro de ofertas.' : 'Ordem de venda criada no livro de ofertas.');
      setError('');
      await refreshSelected(selected.id);
    } catch (err) {
      setError(`Não foi possível criar ordem: ${(err as Error).message}`);
    }
  }

  async function sendMarket(type: 'BUY' | 'SELL') {
    if (!selected) return;
    const quantity = Number(type === 'BUY' ? marketBuyQty : marketSellQty);
    const slippagePercent = Number(type === 'BUY' ? marketBuySlip : marketSellSlip);
    try {
      if (selected.status !== 'ACTIVE') throw new Error('Mercado pausado. Não é possível negociar agora.');
      await api(`/market/companies/${selected.id}/${type === 'BUY' ? 'buy-market' : 'sell-market'}`, {
        method: 'POST',
        body: JSON.stringify({ quantity, slippagePercent }),
      });
      if (type === 'BUY') setMarketBuyQty('');
      if (type === 'SELL') setMarketSellQty('');
      setMessage(type === 'BUY' ? 'Compra realizada com sucesso.' : 'Venda realizada com sucesso.');
      setError('');
      await refreshSelected(selected.id);
    } catch (err) {
      setError(`Não foi possível enviar ordem agora: ${(err as Error).message}`);
    }
  }

  async function cancelOrder(orderId: string) {
    if (!selected) return;
    try {
      await api(`/market/orders/${orderId}/cancel`, { method: 'POST' });
      setMessage('Ordem cancelada com sucesso.');
      await refreshSelected(selected.id);
    } catch (err) {
      setError(`Falha ao cancelar ordem: ${(err as Error).message}`);
    }
  }

  const buyFee = Number(selected?.buyFeePercent ?? '0');
  const sellFee = Number(selected?.sellFeePercent ?? '0');
  const limitSubtotal = (Number(limitQty) || 0) * (Number(limitPrice) || 0);
  const limitTotalBuy = limitSubtotal * (1 + buyFee / 100);
  const limitNetSell = limitSubtotal * (1 - sellFee / 100);

  const bestAsk = useMemo(() => (book.sellOrders.length > 0 ? Number(book.sellOrders[0].limitPrice ?? 0) : Number(selected?.currentPrice ?? 0)), [book.sellOrders, selected?.currentPrice]);
  const bestBid = useMemo(() => (book.buyOrders.length > 0 ? Number(book.buyOrders[0].limitPrice ?? 0) : Number(selected?.currentPrice ?? 0)), [book.buyOrders, selected?.currentPrice]);
  const maxBuyVolume = useMemo(() => Math.max(0, ...book.buyOrders.map((order) => order.remainingQuantity)), [book.buyOrders]);
  const maxSellVolume = useMemo(() => Math.max(0, ...book.sellOrders.map((order) => order.remainingQuantity)), [book.sellOrders]);
  const chartData = useMemo(
    () => normalizeChartData(trades, Number(selected?.initialPrice ?? 1), Number(selected?.currentPrice ?? selected?.initialPrice ?? 1)),
    [trades, selected?.currentPrice, selected?.initialPrice]
  );
  const priceTicks = useMemo(() => buildPriceTicks(chartData.minPrice, chartData.maxPrice), [chartData.minPrice, chartData.maxPrice]);
  const totalBuyStrength = useMemo(() => book.buyOrders.reduce((sum, order) => sum + order.remainingQuantity, 0), [book.buyOrders]);
  const totalSellStrength = useMemo(() => book.sellOrders.reduce((sum, order) => sum + order.remainingQuantity, 0), [book.sellOrders]);
  const totalStrength = totalBuyStrength + totalSellStrength;
  const buyStrengthPercent = totalStrength > 0 ? (totalBuyStrength / totalStrength) * 100 : 0;
  const sellStrengthPercent = totalStrength > 0 ? (totalSellStrength / totalStrength) * 100 : 0;
  const totalTradeVolume = useMemo(() => trades.reduce((sum, trade) => sum + trade.quantity, 0), [trades]);

  const visibleCompanies = useMemo(() => companies.filter((company) => `${company.name} ${company.ticker}`.toLowerCase().includes(search.toLowerCase())), [companies, search]);
  const featuredCompanies = useMemo(() => companies.slice(0, 3), [companies]);

  return (
    <section className="card market-page">
      {!selected && (
        <>
          <h2>🪙 Mercados</h2>
          <input placeholder="Buscar token ou ticker" value={search} onChange={(e) => setSearch(e.target.value)} />
          <nav className="quick-actions nested-card">
            <button className={marketListTab === 'mercado' ? 'quick-pill active' : 'quick-pill'} onClick={() => setMarketListTab('mercado')}>Mercado</button>
            <button className={marketListTab === 'destaques' ? 'quick-pill active' : 'quick-pill'} onClick={() => setMarketListTab('destaques')}>Destaques</button>
          </nav>
          <p className="info-text">Negocie tokens criados por usuários usando RPC.</p>
          {error && <p className="status-message error">{error}</p>}
          {companies.length === 0 && <p className="empty-state">Nenhum token listado ainda.</p>}
          <ul className="company-list">
            {(marketListTab === 'destaques' ? featuredCompanies.filter((company) => `${company.name} ${company.ticker}`.toLowerCase().includes(search.toLowerCase())) : visibleCompanies).map((company) => (
              <li key={company.id} className="card company-visual-card finance-card">
                <p className="company-emoji">🪙 {company.ticker}/RPC</p>
                <strong>{company.name}</strong>
                <p className="info-text">Projeto/token criado por usuário • Categoria: {company.sector} • Status: {translateCompanyStatus(company.status)}</p>
                <p className="price-highlight">Preço atual em RPC: {formatPrice(Number(company.currentPrice || company.initialPrice))} RPC</p>
                {(() => { const changePercent = getPriceChangePercent(company); return <p className={changePercent >= 0 ? 'positive-change' : 'negative-change'}>{changePercent >= 0 ? '▲' : '▼'} {formatPercent(Math.abs(changePercent))}%</p>; })()}
                <p className="info-text">Tokens disponíveis: {company.availableOfferShares.toLocaleString('pt-BR')}</p>
                <button className="button-primary" onClick={() => selectCompany(company.id)}>Negociar</button>
              </li>
            ))}
          </ul>
          {(marketListTab === 'mercado' ? visibleCompanies : featuredCompanies.filter((company) => `${company.name} ${company.ticker}`.toLowerCase().includes(search.toLowerCase()))).length === 0 && (
            <p className="empty-state">Nenhum token encontrado para essa busca.</p>
          )}
        </>
      )}

      {selected && (
        <div className="trade-screen">
          <header className="card trade-header market-pair-header">
            <div className="market-pair-title">
              <button className="back-button" onClick={() => setSelected(null)}>←</button>
              <strong>{selected.ticker}/RPC</strong>
              <span>▾</span>
              <span title="Favorito (visual)">☆</span>
              <span title="Alerta (visual)">🔔</span>
            </div>
            <p>{selected.name}</p>
            <div className="market-price-overview">
              <p className="trade-price-big">{formatPrice(Number(selected.currentPrice))} RPC</p>
              <p className={chartData.variationPercent >= 0 ? 'positive-change' : 'negative-change'}>
                {chartData.variationPercent >= 0 ? '▲' : '▼'} {formatPercent(Math.abs(chartData.variationPercent))}%
              </p>
            </div>
            <div className="market-stats-row">
              <span>Inicial: {formatPrice(Number(selected.initialPrice))}</span>
              <span>Máx: {formatPrice(chartData.maxPrice)}</span>
              <span>Mín: {formatPrice(chartData.minPrice)}</span>
              <span>Volume: {totalTradeVolume > 0 ? totalTradeVolume.toLocaleString('pt-BR') : 'Sem negociações'}</span>
              <span>Setor: {selected.sector}</span>
              <span>Status: {translateCompanyStatus(selected.status)}</span>
            </div>
            <div className="summary-grid">
              <div className="summary-item"><span className="summary-label">Setor</span><strong className="summary-value">{selected.sector}</strong></div>
              <div className="summary-item"><span className="summary-label">Meus tokens</span><strong className="summary-value">{holdingQty}</strong></div>
              <div className="summary-item"><span className="summary-label">Saldo disponível</span><strong className="summary-value">{formatCurrency(walletBalance)} RPC</strong></div>
            </div>
            <div className="summary-grid market-balance-cards nested-card"><div className="summary-item"><span className="summary-label">Saldo RPC disponível</span><strong className="summary-value">{formatCurrency(walletBalance)} RPC</strong></div><div className="summary-item"><span className="summary-label">Tokens em carteira</span><strong className="summary-value">{holdingQty}</strong></div></div>
          </header>

          {error && <p className="status-message error">{error}</p>}
          {message && <p className="status-message success">{message}</p>}


          <nav className="market-top-tabs nested-card" aria-label="Abas do mercado">
            <button className={activeTab === 'preco' ? 'quick-pill active' : 'quick-pill'} onClick={() => setActiveTab('preco')}>Preço</button>
            <button className={activeTab === 'info' ? 'quick-pill active' : 'quick-pill'} onClick={() => setActiveTab('info')}>Informações</button>
            <button className={activeTab === 'dados' ? 'quick-pill active' : 'quick-pill'} onClick={() => setActiveTab('dados')}>Dados de trading</button>
            <button className={activeTab === 'ordens' ? 'quick-pill active' : 'quick-pill'} onClick={() => setActiveTab('ordens')}>Ordens</button>
            <button className={activeTab === 'historico' ? 'quick-pill active' : 'quick-pill'} onClick={() => setActiveTab('historico')}>Negociações recentes</button>
          </nav>

          {activeTab === 'info' && <section className="card nested-card"><h4>Informações</h4><p className="info-text">{selected.description || 'Projeto/token listado para negociação em ambiente RP.'}</p><p className="info-text">Oferta disponível: {selected.availableOfferShares.toLocaleString('pt-BR')}</p><p className="info-text">Total de tokens: {selected.totalShares.toLocaleString('pt-BR')}</p></section>}
          {activeTab === 'dados' && <section className="card nested-card"><h4>Dados de trading</h4><p className="info-text">Taxa de compra: {buyFee}%</p><p className="info-text">Taxa de venda: {sellFee}%</p><p className="info-text">Supply: {selected.totalShares.toLocaleString('pt-BR')}</p><p className="info-text">Oferta disponível: {selected.availableOfferShares.toLocaleString('pt-BR')}</p><p className="info-text">Market cap fictício: {formatCurrency(Number(selected.currentPrice) * selected.totalShares)} RPC</p></section>}

          {activeTab === 'preco' && (
            <section className="card nested-card">
              <h4>📈 Gráfico</h4>
              <div className="chart-timeframes">
                {['Time', '15m', '1h', '4h', '1D', 'Mais', 'Profundidade'].map((tf) => <button key={tf} className="quick-pill">{tf}</button>)}
              </div>
              <div className="chart-wrap chart-wrap-highlight modern-chart-shell">
                <svg viewBox="0 0 118 100" preserveAspectRatio="none" className="line-chart">
                  <defs>
                    <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
                      <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#d7e2ff" strokeWidth="0.4" />
                    </pattern>
                  </defs>
                  <rect x="0" y="0" width="100" height="100" fill="url(#grid)" />
                  <polyline points={chartData.points.map((point) => `${point.x},${point.y}`).join(' ')} fill="none" stroke="#4f46e5" strokeWidth="2.6" vectorEffect="non-scaling-stroke" />
                  <line className="current-price-line" x1="0" x2="100" y1={chartData.points[chartData.points.length - 1].y} y2={chartData.points[chartData.points.length - 1].y} />
                  <circle cx={chartData.points[chartData.points.length - 1].x} cy={chartData.points[chartData.points.length - 1].y} r="1.4" fill="#f8fafc" />
                  {priceTicks.map((tick) => {
                    const y = 100 - (((tick - (chartData.minPrice - Math.max((chartData.maxPrice - chartData.minPrice) * 0.2, 0.01))) / ((chartData.maxPrice + Math.max((chartData.maxPrice - chartData.minPrice) * 0.2, 0.01)) - (chartData.minPrice - Math.max((chartData.maxPrice - chartData.minPrice) * 0.2, 0.01)))) * 100);
                    return <text key={tick} x="102" y={Math.max(2, Math.min(98, y))} className="price-scale-label">{formatPrice(tick)}</text>;
                  })}
                  <rect x="102" y={chartData.points[chartData.points.length - 1].y - 3} width="14" height="6" rx="1.2" className="current-price-badge" />
                  <text x="109" y={chartData.points[chartData.points.length - 1].y + 1.2} textAnchor="middle" fontSize="2.1" fill="#0f172a">{formatPrice(chartData.currentPrice)}</text>
                </svg>
              </div>
              <div className="chart-meta"><div><span>Atual</span><strong>{formatPrice(chartData.lastPrice)}</strong></div><div><span>Máximo</span><strong>{formatPrice(chartData.maxPrice)}</strong></div><div><span>Mínimo</span><strong>{formatPrice(chartData.minPrice)}</strong></div></div>
              <div className="summary-item">
                <p><strong>Preço inicial:</strong> {formatPrice(chartData.initialPrice)} RPC</p>
                <p><strong>Preço atual:</strong> {formatPrice(chartData.currentPrice)} RPC</p>
                <p><strong>Variação:</strong> {formatSignedPrice(chartData.variationAbsolute)} RPC</p>
                <p><strong>Variação percentual:</strong> {chartData.variationPercent >= 0 ? '+' : '-'}{formatPercent(Math.abs(chartData.variationPercent))}%</p>
              </div>
              <p className="info-text">MA: legenda visual baseada na série atual.</p>
              <div className="volume-mini-chart">
                {trades.length === 0 && <p className="empty-state">Sem volume de negociações ainda.</p>}
                {trades.length > 0 && <div className="volume-bars">{trades.map((trade) => {
                  const max = Math.max(...trades.map((item) => item.quantity));
                  const height = max > 0 ? Math.max(6, (trade.quantity / max) * 60) : 6;
                  return <div key={trade.id} style={{ height: `${height}px` }} title={`Qtd ${trade.quantity}`} />;
                })}</div>}
              </div>
              <div className="indicator-tabs">
                {(['MA', 'EMA', 'BOLL', 'VOL', 'MACD', 'RSI'] as const).map((indicator) => (
                  <button key={indicator} className={activeIndicator === indicator ? 'quick-pill active' : 'quick-pill'} onClick={() => setActiveIndicator(indicator)}>{indicator}</button>
                ))}
              </div>
              <h4>📊 Livro de ofertas</h4>
              <div className="book-strength-bar">
                <div className="book-strength-buy" style={{ width: `${buyStrengthPercent}%` }}>Compradores {Math.round(buyStrengthPercent)}%</div>
                <div className="book-strength-sell" style={{ width: `${sellStrengthPercent}%` }}>Vendedores {Math.round(sellStrengthPercent)}%</div>
              </div>
              <div className="chart-action-bar">
                <button className="button-success" disabled={selected.status !== 'ACTIVE'} onClick={() => { setTradeFlow('buy'); setBuyMode('initial'); }}>Comprar</button>
                <button className="button-danger" disabled={selected.status !== 'ACTIVE'} onClick={() => { setTradeFlow('sell'); setSellMode('limit'); }}>Vender</button>
              </div>
              {chartData.note && <p className="info-text">{chartData.note}</p>}
            </section>
          )}
          {activeTab === 'preco' && (
            <section className="card nested-card">
              <div className="summary-grid order-book-grid">
                <div className="summary-item buy-side">
                  <strong>Compras</strong>
                  {book.buyOrders.length === 0 && <p className="empty-state">Sem ordens de compra no momento.</p>}
                  {book.buyOrders.map((order) => {
                    const price = Number(order.limitPrice ?? 0);
                    const total = price * order.remainingQuantity;
                    const barWidth = getBookVolumeWeight(order, maxBuyVolume);
                    return (
                      <div key={order.id} className="order-book-row">
                        <div className="order-book-bar buy" style={{ width: `${barWidth}%` }} />
                        <p>{formatPrice(price)} | Qtd: {order.remainingQuantity} | Total: {formatCurrency(total)}</p>
                      </div>
                    );
                  })}
                </div>
                <div className="summary-item sell-side">
                  <strong>Vendas</strong>
                  {book.sellOrders.length === 0 && <p className="empty-state">Sem ordens de venda no momento.</p>}
                  {book.sellOrders.map((order) => {
                    const price = Number(order.limitPrice ?? 0);
                    const total = price * order.remainingQuantity;
                    const barWidth = getBookVolumeWeight(order, maxSellVolume);
                    return (
                      <div key={order.id} className="order-book-row">
                        <div className="order-book-bar sell" style={{ width: `${barWidth}%` }} />
                        <p>{formatPrice(price)} | Qtd: {order.remainingQuantity} | Total: {formatCurrency(total)}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="summary-item nested-card"><strong>Preço atual: {formatPrice(Number(selected.currentPrice))}</strong></div>
            </section>
          )}

          {activeTab === 'ordens' && (
            <section className="card nested-card">
              <h4>🧾 Minhas ordens</h4>
              {myOrders.length === 0 && <p className="empty-state">Você ainda não possui ordens neste mercado.</p>}
              <div className="mobile-card-list">{myOrders.map((order) => (<article key={order.id} className="summary-item compact-card"><p><strong>{translateOrderType(order.type)}</strong> · {translateOrderMode(order.mode)}</p><p>Quantidade: {order.quantity} · Restante: {order.remainingQuantity}</p><p>Status: {translateOrderStatus(order.status)}</p><p>Preço: {order.limitPrice ? formatPrice(Number(order.limitPrice)) : 'Agora'}</p>{(order.status === 'OPEN' || order.status === 'PARTIALLY_FILLED') && order.mode === 'LIMIT' && <button className="button-danger" onClick={() => cancelOrder(order.id)}>Cancelar ordem</button>}</article>))}</div>
            </section>
          )}

          {activeTab === 'historico' && (
            <section className="card nested-card">
              <h4>🕒 Negociações recentes</h4>
              {trades.length === 0 && <p className="empty-state">Sem histórico de negociações para este mercado.</p>}
              <div className="mobile-card-list">{trades.map((trade) => (<article key={trade.id} className="summary-item compact-card"><p><strong>Preço:</strong> {formatPrice(Number(trade.unitPrice))}</p><p><strong>Quantidade:</strong> {trade.quantity}</p><p><strong>Data/hora:</strong> {new Date(trade.createdAt).toLocaleString('pt-BR')}</p></article>))}</div>
            </section>
          )}

          {tradeFlow && (
            <div className="trade-panel-backdrop" onClick={() => setTradeFlow(null)}>
              <section className="trade-bottom-sheet" onClick={(event) => event.stopPropagation()}>
                <div className="trade-panel-header">
                  <h4>{tradeFlow === 'buy' ? '🟢 Comprar' : '🔴 Vender'}</h4>
                  <button className="back-button" onClick={() => setTradeFlow(null)}>Fechar</button>
                </div>

                {tradeFlow === 'buy' && (
                  <>
                    <nav className="quick-actions">
                      <button className={buyMode === 'initial' ? 'quick-pill active' : 'quick-pill'} onClick={() => setBuyMode('initial')}>Comprar tokens</button>
                      <button className={buyMode === 'limit' ? 'quick-pill active' : 'quick-pill'} onClick={() => setBuyMode('limit')}>Definir preço</button>
                      <button className={buyMode === 'market' ? 'quick-pill active' : 'quick-pill'} onClick={() => setBuyMode('market')}>Comprar agora</button>
                    </nav>
                    {buyMode === 'initial' && (
                      <form onSubmit={buyInitialOffer}>
                        <p className="info-text">Comprar no lançamento altera o preço atual, mas não cria trade no histórico.</p>
                        <input type="number" min="1" value={initialQty} onChange={(e) => setInitialQty(e.target.value)} placeholder="Quantidade de tokens" required />
                        <button className="button-success" type="submit">Comprar tokens</button>
                      </form>
                    )}
                    {buyMode === 'limit' && <form onSubmit={(event) => createLimitOrder('BUY', event)}><input type="number" min="1" value={limitQty} onChange={(e) => setLimitQty(e.target.value)} placeholder="Quantidade de tokens" required /><input type="number" min="0.01" step="0.01" value={limitPrice} onChange={(e) => setLimitPrice(e.target.value)} placeholder="Preço por token" required /><div className="summary-item"><p>Subtotal: {formatCurrency(limitSubtotal)}</p><p>Taxa: {buyFee}%</p><p>Total estimado: {formatCurrency(limitTotalBuy)}</p></div><button className="button-success" type="submit">Definir preço de compra</button></form>}
                    {buyMode === 'market' && <div><input type="number" min="1" value={marketBuyQty} onChange={(e) => setMarketBuyQty(e.target.value)} placeholder="Quantidade de tokens" /><input type="number" min="0" max="100" value={marketBuySlip} onChange={(e) => setMarketBuySlip(e.target.value)} placeholder="Variação máxima (%)" /><button className="button-success" onClick={() => sendMarket('BUY')}>Comprar agora</button><p className="info-text">Preço agora: {formatPrice(bestAsk)}</p></div>}
                  </>
                )}

                {tradeFlow === 'sell' && (
                  <>
                    <nav className="quick-actions">
                      <button className={sellMode === 'limit' ? 'quick-pill active' : 'quick-pill'} onClick={() => setSellMode('limit')}>Definir preço</button>
                      <button className={sellMode === 'market' ? 'quick-pill active' : 'quick-pill'} onClick={() => setSellMode('market')}>Vender agora</button>
                    </nav>
                    {sellMode === 'limit' && <form onSubmit={(event) => createLimitOrder('SELL', event)}><input type="number" min="1" value={limitQty} onChange={(e) => setLimitQty(e.target.value)} placeholder="Quantidade de tokens" required /><input type="number" min="0.01" step="0.01" value={limitPrice} onChange={(e) => setLimitPrice(e.target.value)} placeholder="Preço por token" required /><div className="summary-item"><p>Subtotal: {formatCurrency(limitSubtotal)}</p><p>Taxa: {sellFee}%</p><p>Total estimado: {formatCurrency(limitNetSell)}</p></div><button className="button-danger" type="submit">Definir preço de venda</button></form>}
                    {sellMode === 'market' && <div><input type="number" min="1" value={marketSellQty} onChange={(e) => setMarketSellQty(e.target.value)} placeholder="Quantidade de tokens" /><input type="number" min="0" max="100" value={marketSellSlip} onChange={(e) => setMarketSellSlip(e.target.value)} placeholder="Variação máxima (%)" /><button className="button-danger" onClick={() => sendMarket('SELL')}>Vender agora</button><p className="info-text">Preço agora: {formatPrice(bestBid)}</p></div>}
                  </>
                )}
              </section>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
