import { FormEvent, useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';
import { formatCurrency, formatPercent, formatPrice, formatSignedPrice } from '../utils/formatters';

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
type DetailTab = 'resumo' | 'grafico' | 'livro' | 'ordens' | 'historico';
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
  const padding = hasRange ? range * 0.15 : 0;
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

  const [activeTab, setActiveTab] = useState<DetailTab>('grafico');
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
      setActiveTab('grafico');
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
      setMessage(type === 'BUY' ? 'Compra agora enviada com sucesso.' : 'Venda agora enviada com sucesso.');
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
  const chartData = useMemo(
    () => normalizeChartData(trades, Number(selected?.initialPrice ?? 1), Number(selected?.currentPrice ?? selected?.initialPrice ?? 1)),
    [trades, selected?.currentPrice, selected?.initialPrice]
  );

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
                <p className="info-text">Projeto/token criado por usuário • Categoria: {company.sector}</p>
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
          <header className="card trade-header">
            <button className="back-button" onClick={() => setSelected(null)}>← Voltar</button>
            <h3>{selected.ticker}</h3>
            <p>{selected.name}</p>
            <p className="warning">Simulação</p>
            <p className="trade-price-big">{formatPrice(Number(selected.currentPrice))} RPC</p>
            <div className="summary-grid">
              <div className="summary-item"><span className="summary-label">Setor</span><strong className="summary-value">{selected.sector}</strong></div>
              <div className="summary-item"><span className="summary-label">Meus tokens</span><strong className="summary-value">{holdingQty}</strong></div>
              <div className="summary-item"><span className="summary-label">Saldo disponível</span><strong className="summary-value">{formatCurrency(walletBalance)} RPC</strong></div>
            </div>
            <div className="summary-grid market-balance-cards nested-card"><div className="summary-item"><span className="summary-label">Saldo RPC disponível</span><strong className="summary-value">{formatCurrency(walletBalance)} RPC</strong></div><div className="summary-item"><span className="summary-label">Tokens em carteira</span><strong className="summary-value">{holdingQty}</strong></div></div>
            <div className="trade-main-actions">
              <button className="button-success" disabled={selected.status !== 'ACTIVE'} onClick={() => { setTradeFlow('buy'); setBuyMode('initial'); }}>Comprar</button>
              <button className="button-danger" disabled={selected.status !== 'ACTIVE'} onClick={() => { setTradeFlow('sell'); setSellMode('limit'); }}>Vender</button>
            </div>
          </header>

          {error && <p className="status-message error">{error}</p>}
          {message && <p className="status-message success">{message}</p>}

          {tradeFlow === 'buy' && (
            <section className="card nested-card">
              <h4>🟢 Comprar</h4>
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
            </section>
          )}

          {tradeFlow === 'sell' && (
            <section className="card nested-card">
              <h4>🔴 Vender</h4>
              <nav className="quick-actions">
                <button className={sellMode === 'limit' ? 'quick-pill active' : 'quick-pill'} onClick={() => setSellMode('limit')}>Definir preço</button>
                <button className={sellMode === 'market' ? 'quick-pill active' : 'quick-pill'} onClick={() => setSellMode('market')}>Vender agora</button>
              </nav>
              {sellMode === 'limit' && <form onSubmit={(event) => createLimitOrder('SELL', event)}><input type="number" min="1" value={limitQty} onChange={(e) => setLimitQty(e.target.value)} placeholder="Quantidade de tokens" required /><input type="number" min="0.01" step="0.01" value={limitPrice} onChange={(e) => setLimitPrice(e.target.value)} placeholder="Preço por token" required /><div className="summary-item"><p>Subtotal: {formatCurrency(limitSubtotal)}</p><p>Taxa: {sellFee}%</p><p>Total estimado: {formatCurrency(limitNetSell)}</p></div><button className="button-danger" type="submit">Definir preço de venda</button></form>}
              {sellMode === 'market' && <div><input type="number" min="1" value={marketSellQty} onChange={(e) => setMarketSellQty(e.target.value)} placeholder="Quantidade de tokens" /><input type="number" min="0" max="100" value={marketSellSlip} onChange={(e) => setMarketSellSlip(e.target.value)} placeholder="Variação máxima (%)" /><button className="button-danger" onClick={() => sendMarket('SELL')}>Vender agora</button><p className="info-text">Preço agora: {formatPrice(bestBid)}</p></div>}
            </section>
          )}

          <nav className="quick-actions nested-card" aria-label="Abas do mercado">
            <button className={activeTab === 'resumo' ? 'quick-pill active' : 'quick-pill'} onClick={() => setActiveTab('resumo')}>Resumo</button>
            <button className={activeTab === 'grafico' ? 'quick-pill active' : 'quick-pill'} onClick={() => setActiveTab('grafico')}>Gráfico</button>
            <button className={activeTab === 'livro' ? 'quick-pill active' : 'quick-pill'} onClick={() => setActiveTab('livro')}>Livro</button>
            <button className={activeTab === 'ordens' ? 'quick-pill active' : 'quick-pill'} onClick={() => setActiveTab('ordens')}>Ordens</button>
            <button className={activeTab === 'historico' ? 'quick-pill active' : 'quick-pill'} onClick={() => setActiveTab('historico')}>Histórico</button>
          </nav>

          {activeTab === 'resumo' && <section className="card nested-card"><h4>Resumo</h4><p className="info-text">Preço atual, taxas e saldo já exibidos no topo para facilitar.</p></section>}

          {activeTab === 'grafico' && (
            <section className="card nested-card">
              <h4>📈 Gráfico</h4>
              <div className="chart-wrap chart-wrap-highlight">
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="line-chart">
                  <defs>
                    <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
                      <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#d7e2ff" strokeWidth="0.4" />
                    </pattern>
                  </defs>
                  <rect x="0" y="0" width="100" height="100" fill="url(#grid)" />
                  <polyline points={chartData.points.map((point) => `${point.x},${point.y}`).join(' ')} fill="none" stroke="#4f46e5" strokeWidth="2.6" vectorEffect="non-scaling-stroke" />
                </svg>
              </div>
              <div className="chart-meta"><div><span>Último</span><strong>{formatPrice(chartData.lastPrice)}</strong></div><div><span>Maior</span><strong>{formatPrice(chartData.maxPrice)}</strong></div><div><span>Menor</span><strong>{formatPrice(chartData.minPrice)}</strong></div></div>
              <div className="summary-item">
                <p><strong>Preço inicial:</strong> {formatPrice(chartData.initialPrice)} RPC</p>
                <p><strong>Preço atual:</strong> {formatPrice(chartData.currentPrice)} RPC</p>
                <p><strong>Variação:</strong> {formatSignedPrice(chartData.variationAbsolute)} RPC</p>
                <p><strong>Variação percentual:</strong> {chartData.variationPercent >= 0 ? '+' : '-'}{formatPercent(Math.abs(chartData.variationPercent))}%</p>
              </div>
              {chartData.note && <p className="info-text">{chartData.note}</p>}
            </section>
          )}

          {activeTab === 'livro' && (
            <section className="card nested-card">
              <h4>📊 Livro de ofertas</h4>
              <div className="summary-item sell-side"><strong>Vendas</strong>{book.sellOrders.length === 0 && <p className="empty-state">Nenhuma oferta disponível ainda.</p>}{book.sellOrders.map((order) => { const price = Number(order.limitPrice ?? 0); return <p key={order.id}>{formatPrice(price)} | {order.remainingQuantity} | {formatCurrency(price * order.remainingQuantity)}</p>; })}</div>
              <div className="summary-item nested-card"><strong>Preço atual: {formatPrice(Number(selected.currentPrice))}</strong></div>
              <div className="summary-item buy-side nested-card"><strong>Compras</strong>{book.buyOrders.length === 0 && <p className="empty-state">Nenhuma oferta disponível ainda.</p>}{book.buyOrders.map((order) => { const price = Number(order.limitPrice ?? 0); return <p key={order.id}>{formatPrice(price)} | {order.remainingQuantity} | {formatCurrency(price * order.remainingQuantity)}</p>; })}</div>
            </section>
          )}

          {activeTab === 'ordens' && (
            <section className="card nested-card">
              <h4>🧾 Minhas ordens</h4>
              {myOrders.length === 0 && <p className="empty-state">Você ainda não possui ordens neste mercado.</p>}
              <div className="mobile-card-list">{myOrders.map((order) => (<article key={order.id} className="summary-item compact-card"><p><strong>{order.type === 'BUY' ? 'Compra' : 'Venda'}</strong> · {order.mode === 'LIMIT' ? 'Definir preço' : 'Agora'}</p><p>Quantidade: {order.quantity} · Restante: {order.remainingQuantity}</p><p>Status: {order.status}</p><p>Preço: {order.limitPrice ? formatPrice(Number(order.limitPrice)) : 'Agora'}</p>{(order.status === 'OPEN' || order.status === 'PARTIALLY_FILLED') && order.mode === 'LIMIT' && <button className="button-danger" onClick={() => cancelOrder(order.id)}>Cancelar ordem</button>}</article>))}</div>
            </section>
          )}

          {activeTab === 'historico' && (
            <section className="card nested-card">
              <h4>🕒 Histórico de negociações</h4>
              {trades.length === 0 && <p className="empty-state">Sem histórico de negociações para este mercado.</p>}
              <div className="mobile-card-list">{trades.map((trade) => (<article key={trade.id} className="summary-item compact-card"><p><strong>Preço:</strong> {formatPrice(Number(trade.unitPrice))}</p><p><strong>Quantidade:</strong> {trade.quantity}</p><p><strong>Data/hora:</strong> {new Date(trade.createdAt).toLocaleString('pt-BR')}</p></article>))}</div>
            </section>
          )}
        </div>
      )}
    </section>
  );
}
