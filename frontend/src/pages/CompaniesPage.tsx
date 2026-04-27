import { FormEvent, useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';

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
  initialOffer?: { totalShares: number; availableShares: number } | null;
};

type Holding = {
  companyId: string;
  quantity: number;
};

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

type Trade = {
  id: string;
  quantity: number;
  unitPrice: string;
  createdAt: string;
};

type ChartPoint = { x: number; y: number };
type DetailTab = 'resumo' | 'grafico' | 'livro' | 'ordens' | 'historico';
type TradeFlow = 'buy' | 'sell' | null;
type BuyMode = 'initial' | 'limit' | 'market';
type SellMode = 'limit' | 'market';

function moeda(value: number) {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function toChartData(trades: Trade[], fallbackPrice: number) {
  const ordered = [...trades].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const prices = ordered.map((trade) => Number(trade.unitPrice)).filter((price) => Number.isFinite(price) && price > 0);
  const hasRealHistory = prices.length >= 2;

  const series = prices.length === 0 ? [fallbackPrice, fallbackPrice] : prices.length === 1 ? [prices[0], prices[0]] : prices;
  const minPrice = Math.min(...series);
  const maxPrice = Math.max(...series);
  const range = Math.max(maxPrice - minPrice, 1);

  const points: ChartPoint[] = series.map((price, index) => ({
    x: series.length === 1 ? 0 : (index / (series.length - 1)) * 100,
    y: 100 - ((price - minPrice) / range) * 100,
  }));

  return { points, minPrice, maxPrice, lastPrice: series[series.length - 1], hasRealHistory };
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
    const response = await api<{ companies: Omit<Company, 'description' | 'currentPrice'>[] }>('/companies');
    setCompanies(response.companies.map((item) => ({ ...item, description: '', currentPrice: item.initialPrice })));
  }

  async function loadWalletAndHolding(companyId?: string) {
    const response = await api<{ wallet: { availableBalance: string }; holdings: Holding[] }>('/me/holdings');
    setWalletBalance(Number(response.wallet.availableBalance));
    const selectedHolding = response.holdings.find((h) => h.companyId === companyId);
    setHoldingQty(selectedHolding?.quantity ?? 0);
  }

  async function loadCompanyDetails(companyId: string) {
    const response = await api<{ company: Company }>(`/companies/${companyId}`);
    setSelected(response.company);
  }

  async function loadMarket(companyId: string) {
    const [orderBook, my, lastTrades] = await Promise.all([
      api<{ buyOrders: MarketOrder[]; sellOrders: MarketOrder[] }>(`/market/companies/${companyId}/order-book`),
      api<{ orders: MarketOrder[] }>('/market/orders/me'),
      api<{ trades: Trade[] }>(`/market/companies/${companyId}/trades`),
    ]);

    setBook(orderBook);
    setMyOrders(my.orders.filter((order) => order.companyId === companyId));
    setTrades(lastTrades.trades);
  }

  async function refreshSelected(companyId?: string) {
    if (!companyId) return;
    await Promise.all([loadCompanyDetails(companyId), loadWalletAndHolding(companyId), loadMarket(companyId)]);
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

  async function selectCompany(id: string) {
    try {
      setError('');
      setMessage('');
      setActiveTab('grafico');
      setTradeFlow(null);
      setBuyMode('initial');
      setSellMode('limit');
      await refreshSelected(id);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function buyInitialOffer(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    try {
      await api(`/companies/${selected.id}/buy-initial-offer`, { method: 'POST', body: JSON.stringify({ quantity: Number(initialQty) }) });
      setInitialQty('');
      setMessage('Compra de cotas concluída com sucesso.');
      setError('');
      await refreshSelected(selected.id);
    } catch (err) {
      setError(`Não foi possível comprar cotas: ${(err as Error).message}`);
      setMessage('');
    }
  }

  async function createLimitOrder(type: 'BUY' | 'SELL', event: FormEvent) {
    event.preventDefault();
    if (!selected) return;

    try {
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
      setError(`Não foi possível criar ordem com preço definido: ${(err as Error).message}`);
      setMessage('');
    }
  }

  async function sendMarket(type: 'BUY' | 'SELL') {
    if (!selected) return;
    const quantity = Number(type === 'BUY' ? marketBuyQty : marketSellQty);
    const slippagePercent = Number(type === 'BUY' ? marketBuySlip : marketSellSlip);

    try {
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
      setMessage('');
    }
  }

  async function cancelOrder(orderId: string) {
    if (!selected) return;
    try {
      await api(`/market/orders/${orderId}/cancel`, { method: 'POST' });
      setMessage('Ordem cancelada com sucesso.');
      setError('');
      await refreshSelected(selected.id);
    } catch (err) {
      setError(`Falha ao cancelar ordem: ${(err as Error).message}`);
      setMessage('');
    }
  }

  const buyFee = Number(selected?.buyFeePercent ?? '0');
  const sellFee = Number(selected?.sellFeePercent ?? '0');
  const limitQtyN = Number(limitQty) || 0;
  const limitPriceN = Number(limitPrice) || 0;
  const limitSubtotal = limitQtyN * limitPriceN;
  const limitBuyFeeValue = limitSubtotal * (buyFee / 100);
  const limitSellFeeValue = limitSubtotal * (sellFee / 100);
  const limitTotalBuy = limitSubtotal + limitBuyFeeValue;
  const limitNetSell = limitSubtotal - limitSellFeeValue;

  const bestAsk = useMemo(() => (book.sellOrders.length > 0 ? Number(book.sellOrders[0].limitPrice ?? 0) : 0), [book.sellOrders]);
  const bestBid = useMemo(() => (book.buyOrders.length > 0 ? Number(book.buyOrders[0].limitPrice ?? 0) : 0), [book.buyOrders]);

  const chartData = useMemo(() => {
    const fallback = Number(selected?.currentPrice ?? selected?.initialPrice ?? '0') || 0;
    return toChartData(trades, fallback);
  }, [trades, selected?.currentPrice, selected?.initialPrice]);

  const linePoints = chartData.points.map((point) => `${point.x},${point.y}`).join(' ');

  return (
    <section className="card market-page">
      {!selected && (
        <>
          <h2>🏢 Mercados</h2>
          <p className="info-text">Escolha uma empresa para abrir os detalhes dela.</p>
          {error && <p className="status-message error">{error}</p>}
          {message && <p className="status-message success">{message}</p>}

          <ul className="company-list">
            {companies.map((company) => (
              <li key={company.id} className="card company-visual-card">
                <div>
                  <p className="company-emoji">🏢 {company.ticker}</p>
                  <strong>{company.name}</strong>
                  <p className="info-text">Preço atual: {moeda(Number(company.currentPrice || company.initialPrice))} moedas</p>
                  <p className="info-text">Comprar cotas: {company.availableOfferShares.toLocaleString('pt-BR')} disponíveis</p>
                </div>
                <button className="button-primary" onClick={() => selectCompany(company.id)}>Abrir empresa</button>
              </li>
            ))}
          </ul>
        </>
      )}

      {selected && (
        <div className="trade-screen">
          <header className="card trade-header">
            <button className="back-button" onClick={() => setSelected(null)}>← Voltar</button>
            <h3>{selected.ticker}</h3>
            <p className="info-text">{selected.name}</p>
            <p className="warning">Simulação</p>
            <p className="trade-price-big">{moeda(Number(selected.currentPrice))}</p>

            <div className="trade-main-actions">
              <button className="button-success" onClick={() => { setTradeFlow('buy'); setBuyMode('initial'); }}>Comprar</button>
              <button className="button-danger" onClick={() => { setTradeFlow('sell'); setSellMode('limit'); }}>Vender</button>
            </div>
          </header>

          {error && <p className="status-message error">{error}</p>}
          {message && <p className="status-message success">{message}</p>}

          {tradeFlow === 'buy' && (
            <section className="card nested-card">
              <h4>🟢 Comprar</h4>
              <nav className="quick-actions">
                <button className={buyMode === 'initial' ? 'quick-pill active' : 'quick-pill'} onClick={() => setBuyMode('initial')}>Comprar cotas</button>
                <button className={buyMode === 'limit' ? 'quick-pill active' : 'quick-pill'} onClick={() => setBuyMode('limit')}>Definir preço</button>
                <button className={buyMode === 'market' ? 'quick-pill active' : 'quick-pill'} onClick={() => setBuyMode('market')}>Comprar agora</button>
              </nav>

              {buyMode === 'initial' && (
                <form onSubmit={buyInitialOffer} className="form-grid">
                  <input type="number" min="1" value={initialQty} onChange={(e) => setInitialQty(e.target.value)} placeholder="Quantidade de cotas" required />
                  <div className="summary-item">
                    <p>Preço unitário: {moeda(Number(selected.initialPrice))}</p>
                    <p>Subtotal: {moeda((Number(initialQty) || 0) * Number(selected.initialPrice))}</p>
                    <p>Taxa: {buyFee}%</p>
                    <p>Total estimado: {moeda((Number(initialQty) || 0) * Number(selected.initialPrice) * (1 + buyFee / 100))}</p>
                  </div>
                  <button className="button-success" type="submit">Comprar</button>
                </form>
              )}

              {buyMode === 'limit' && (
                <form onSubmit={(event) => createLimitOrder('BUY', event)} className="form-grid">
                  <input type="number" min="1" value={limitQty} onChange={(e) => setLimitQty(e.target.value)} placeholder="Quantidade de cotas" required />
                  <input type="number" min="0.01" step="0.01" value={limitPrice} onChange={(e) => setLimitPrice(e.target.value)} placeholder="Definir preço de compra" required />
                  <div className="summary-item">
                    <p>Subtotal: {moeda(limitSubtotal)}</p>
                    <p>Taxa: {buyFee}%</p>
                    <p>Total estimado: {moeda(limitTotalBuy)}</p>
                  </div>
                  <button className="button-success" type="submit">Comprar</button>
                </form>
              )}

              {buyMode === 'market' && (
                <div className="form-grid">
                  <input type="number" min="1" value={marketBuyQty} onChange={(e) => setMarketBuyQty(e.target.value)} placeholder="Quantidade de cotas" />
                  <input type="number" min="0" max="100" value={marketBuySlip} onChange={(e) => setMarketBuySlip(e.target.value)} placeholder="Variação máxima (%)" />
                  <div className="summary-item">
                    <p>Preço agora: {moeda(bestAsk)}</p>
                    <p>Subtotal: {moeda((Number(marketBuyQty) || 0) * bestAsk)}</p>
                    <p>Taxa: {buyFee}%</p>
                    <p>Total estimado: {moeda((Number(marketBuyQty) || 0) * bestAsk * (1 + buyFee / 100))}</p>
                  </div>
                  <button className="button-success" onClick={() => sendMarket('BUY')}>Comprar</button>
                </div>
              )}
            </section>
          )}

          {tradeFlow === 'sell' && (
            <section className="card nested-card">
              <h4>🔴 Vender</h4>
              <nav className="quick-actions">
                <button className={sellMode === 'limit' ? 'quick-pill active' : 'quick-pill'} onClick={() => setSellMode('limit')}>Definir preço</button>
                <button className={sellMode === 'market' ? 'quick-pill active' : 'quick-pill'} onClick={() => setSellMode('market')}>Vender agora</button>
              </nav>

              {sellMode === 'limit' && (
                <form onSubmit={(event) => createLimitOrder('SELL', event)} className="form-grid">
                  <input type="number" min="1" value={limitQty} onChange={(e) => setLimitQty(e.target.value)} placeholder="Quantidade de cotas" required />
                  <input type="number" min="0.01" step="0.01" value={limitPrice} onChange={(e) => setLimitPrice(e.target.value)} placeholder="Definir preço de venda" required />
                  <div className="summary-item">
                    <p>Subtotal: {moeda(limitSubtotal)}</p>
                    <p>Taxa: {sellFee}%</p>
                    <p>Total estimado: {moeda(limitNetSell)}</p>
                  </div>
                  <button className="button-danger" type="submit">Vender</button>
                </form>
              )}

              {sellMode === 'market' && (
                <div className="form-grid">
                  <input type="number" min="1" value={marketSellQty} onChange={(e) => setMarketSellQty(e.target.value)} placeholder="Quantidade de cotas" />
                  <input type="number" min="0" max="100" value={marketSellSlip} onChange={(e) => setMarketSellSlip(e.target.value)} placeholder="Variação máxima (%)" />
                  <div className="summary-item">
                    <p>Preço agora: {moeda(bestBid)}</p>
                    <p>Subtotal: {moeda((Number(marketSellQty) || 0) * bestBid)}</p>
                    <p>Taxa: {sellFee}%</p>
                    <p>Total estimado: {moeda((Number(marketSellQty) || 0) * bestBid * (1 - sellFee / 100))}</p>
                  </div>
                  <button className="button-danger" onClick={() => sendMarket('SELL')}>Vender</button>
                </div>
              )}
            </section>
          )}

          <nav className="quick-actions nested-card" aria-label="Abas da empresa">
            <button className={activeTab === 'resumo' ? 'quick-pill active' : 'quick-pill'} onClick={() => setActiveTab('resumo')}>Resumo</button>
            <button className={activeTab === 'grafico' ? 'quick-pill active' : 'quick-pill'} onClick={() => setActiveTab('grafico')}>Gráfico</button>
            <button className={activeTab === 'livro' ? 'quick-pill active' : 'quick-pill'} onClick={() => setActiveTab('livro')}>Livro</button>
            <button className={activeTab === 'ordens' ? 'quick-pill active' : 'quick-pill'} onClick={() => setActiveTab('ordens')}>Ordens</button>
            <button className={activeTab === 'historico' ? 'quick-pill active' : 'quick-pill'} onClick={() => setActiveTab('historico')}>Histórico</button>
          </nav>

          {activeTab === 'resumo' && (
            <section className="card nested-card">
              <h4>Resumo rápido</h4>
              <div className="summary-grid">
                <div className="summary-item"><span className="summary-label">Setor</span><strong className="summary-value">{selected.sector}</strong></div>
                <div className="summary-item"><span className="summary-label">Meu saldo</span><strong className="summary-value">{moeda(walletBalance)}</strong></div>
                <div className="summary-item"><span className="summary-label">Minhas cotas</span><strong className="summary-value">{holdingQty}</strong></div>
                <div className="summary-item"><span className="summary-label">Taxas</span><strong className="summary-value">Compra {buyFee}% · Venda {sellFee}%</strong></div>
              </div>
            </section>
          )}

          {activeTab === 'grafico' && (
            <section className="card nested-card">
              <h4>📈 Gráfico</h4>
              <div className="chart-wrap chart-wrap-highlight">
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="line-chart" role="img" aria-label="Gráfico de linha do histórico de preço">
                  <polyline points={linePoints} fill="none" stroke="#53d7ff" strokeWidth="2.6" vectorEffect="non-scaling-stroke" />
                </svg>
              </div>
              <div className="chart-meta">
                <div><span>Último preço</span><strong>{moeda(chartData.lastPrice)}</strong></div>
                <div><span>Maior</span><strong>{moeda(chartData.maxPrice)}</strong></div>
                <div><span>Menor</span><strong>{moeda(chartData.minPrice)}</strong></div>
              </div>
              {!chartData.hasRealHistory && <p className="info-text">Sem negociações suficientes ainda. Exibindo linha base.</p>}
            </section>
          )}

          {activeTab === 'livro' && (
            <section className="card nested-card">
              <h4>📚 Livro de ofertas</h4>
              <p className="info-text">Preço | Quantidade | Total</p>
              <div className="summary-item sell-side">
                <strong>Vendas</strong>
                {book.sellOrders.length === 0 && <p className="info-text">Sem ofertas de venda.</p>}
                {book.sellOrders.map((order) => {
                  const price = Number(order.limitPrice ?? 0);
                  return <p key={order.id}>{moeda(price)} | {order.remainingQuantity} | {moeda(price * order.remainingQuantity)}</p>;
                })}
              </div>
              <div className="summary-item buy-side nested-card">
                <strong>Compras</strong>
                {book.buyOrders.length === 0 && <p className="info-text">Sem ofertas de compra.</p>}
                {book.buyOrders.map((order) => {
                  const price = Number(order.limitPrice ?? 0);
                  return <p key={order.id}>{moeda(price)} | {order.remainingQuantity} | {moeda(price * order.remainingQuantity)}</p>;
                })}
              </div>
            </section>
          )}

          {activeTab === 'ordens' && (
            <section className="card nested-card">
              <h4>🧾 Minhas ordens</h4>
              <div className="mobile-card-list">
                {myOrders.length === 0 && <p className="info-text">Você ainda não possui ordens nesta empresa.</p>}
                {myOrders.map((order) => (
                  <article key={order.id} className="summary-item">
                    <p><strong>{order.type === 'BUY' ? 'Compra' : 'Venda'}</strong> · {order.mode === 'LIMIT' ? 'Definir preço' : 'Agora'}</p>
                    <p>Status: {order.status}</p>
                    <p>Quantidade: {order.quantity}</p>
                    <p>Preço: {order.limitPrice ? moeda(Number(order.limitPrice)) : '-'}</p>
                    {(order.status === 'OPEN' || order.status === 'PARTIALLY_FILLED') && order.mode === 'LIMIT' && (
                      <button className="button-danger" onClick={() => cancelOrder(order.id)}>Cancelar ordem</button>
                    )}
                  </article>
                ))}
              </div>
            </section>
          )}

          {activeTab === 'historico' && (
            <section className="card nested-card">
              <h4>🕒 Últimas negociações</h4>
              <div className="mobile-card-list">
                {trades.length === 0 && <p className="info-text">Sem negociações registradas para esta empresa.</p>}
                {trades.map((trade) => (
                  <article key={trade.id} className="summary-item compact-card">
                    <p><strong>Preço:</strong> {moeda(Number(trade.unitPrice))}</p>
                    <p><strong>Quantidade:</strong> {trade.quantity}</p>
                    <p><strong>Data:</strong> {new Date(trade.createdAt).toLocaleString('pt-BR')}</p>
                  </article>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </section>
  );
}
