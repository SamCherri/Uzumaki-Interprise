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
  company: { ticker: string; name: string };
};

type Trade = {
  id: string;
  quantity: number;
  unitPrice: string;
  createdAt: string;
};

type ChartPoint = {
  x: number;
  y: number;
};

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

  const points: ChartPoint[] = series.map((price, index) => {
    const x = series.length === 1 ? 0 : (index / (series.length - 1)) * 100;
    const y = 100 - ((price - minPrice) / range) * 100;
    return { x, y };
  });

  return {
    points,
    minPrice,
    maxPrice,
    lastPrice: series[series.length - 1],
    hasRealHistory,
  };
}

export function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [selected, setSelected] = useState<Company | null>(null);
  const [walletBalance, setWalletBalance] = useState(0);
  const [holdingQty, setHoldingQty] = useState(0);
  const [book, setBook] = useState<{ buyOrders: MarketOrder[]; sellOrders: MarketOrder[] }>({ buyOrders: [], sellOrders: [] });
  const [myOrders, setMyOrders] = useState<MarketOrder[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);

  const [initialQty, setInitialQty] = useState('');
  const [limitType, setLimitType] = useState<'BUY' | 'SELL'>('BUY');
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
    setSelectedId(companyId);
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
      setMessage('Compra da oferta inicial concluída com sucesso.');
      setError('');
      await refreshSelected(selected.id);
    } catch (err) {
      setError(`Não foi possível concluir a compra inicial: ${(err as Error).message}`);
      setMessage('');
    }
  }

  async function createLimitOrder(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;

    try {
      await api('/market/orders', {
        method: 'POST',
        body: JSON.stringify({
          companyId: selected.id,
          type: limitType,
          mode: 'LIMIT',
          quantity: Number(limitQty),
          limitPrice: Number(limitPrice),
        }),
      });
      setLimitQty('');
      setLimitPrice('');
      setMessage('Ordem limitada criada e enviada para o livro de ofertas.');
      setError('');
      await refreshSelected(selected.id);
    } catch (err) {
      setError(`Não foi possível criar a ordem limitada: ${(err as Error).message}`);
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
      setMessage(`${type === 'BUY' ? 'Compra' : 'Venda'} a mercado enviada com sucesso.`);
      setError('');
      await refreshSelected(selected.id);
    } catch (err) {
      setError(`Não foi possível enviar a ordem a mercado: ${(err as Error).message}`);
      setMessage('');
    }
  }

  async function cancelOrder(orderId: string) {
    if (!selected) return;
    try {
      await api(`/market/orders/${orderId}/cancel`, { method: 'POST' });
      setMessage('Ordem cancelada com sucesso e recursos liberados.');
      setError('');
      await refreshSelected(selected.id);
    } catch (err) {
      setError(`Falha ao cancelar ordem: ${(err as Error).message}`);
      setMessage('');
    }
  }

  const limitQtyN = Number(limitQty) || 0;
  const limitPriceN = Number(limitPrice) || 0;
  const buyFee = Number(selected?.buyFeePercent ?? '0');
  const sellFee = Number(selected?.sellFeePercent ?? '0');
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

  const lastTradePrice = trades.length > 0 ? Number(trades[0].unitPrice) : null;

  return (
    <section className="card market-page">
      <h2>🏢 Empresas</h2>
      <p className="info-text">Selecione uma empresa para acompanhar preço, enviar ordens e operar no mercado secundário.</p>

      {error && <p className="status-message error">{error}</p>}
      {message && <p className="status-message success">{message}</p>}

      <ul className="company-list">
        {companies.map((company) => (
          <li key={company.id} className="card company-visual-card">
            <div>
              <p className="company-emoji">🏢 {company.ticker}</p>
              <strong>{company.name}</strong>
              <p className="info-text">Preço atual: {moeda(Number(company.currentPrice || company.initialPrice))} moeda</p>
              <p className="info-text">Cotas disponíveis: {company.availableOfferShares.toLocaleString('pt-BR')}</p>
            </div>
            <button className="button-primary" onClick={() => selectCompany(company.id)}>
              Negociar
            </button>
          </li>
        ))}
      </ul>

      {selectedId && selected && (
        <div className="nested-card app-sections-grid">
          <section className="card hero-asset-card">
            <p className="eyebrow">📌 Resumo do ativo</p>
            <h3>
              {selected.ticker} · {selected.name}
            </h3>
            <p className="info-text">Setor: {selected.sector}</p>
            <p className="info-text">Preço atual: {moeda(Number(selected.currentPrice))} moedas</p>
            <p className="info-text">Último preço negociado: {lastTradePrice !== null ? moeda(lastTradePrice) : 'Sem negociações'}</p>
            <p className="info-text">Status oferta inicial: {selected.availableOfferShares > 0 ? 'Disponível' : 'Encerrada'}</p>
            <p className="warning">Simulação econômica fictícia · Sem dinheiro real.</p>

            <div className="summary-grid nested-card">
              <div className="summary-item">
                <span className="summary-label">🪙 Saldo</span>
                <strong className="summary-value">{moeda(walletBalance)}</strong>
              </div>
              <div className="summary-item">
                <span className="summary-label">Suas cotas</span>
                <strong className="summary-value">{holdingQty}</strong>
              </div>
              <div className="summary-item">
                <span className="summary-label">Preço inicial</span>
                <strong className="summary-value">{moeda(Number(selected.initialPrice))}</strong>
              </div>
              <div className="summary-item">
                <span className="summary-label">Cotas disponíveis</span>
                <strong className="summary-value">{selected.availableOfferShares}</strong>
              </div>
              <div className="summary-item">
                <span className="summary-label">Taxa compra</span>
                <strong className="summary-value">{selected.buyFeePercent}%</strong>
              </div>
              <div className="summary-item">
                <span className="summary-label">Taxa venda</span>
                <strong className="summary-value">{selected.sellFeePercent}%</strong>
              </div>
              <div className="summary-item">
                <span className="summary-label">Máxima</span>
                <strong className="summary-value">{moeda(chartData.maxPrice)}</strong>
              </div>
              <div className="summary-item">
                <span className="summary-label">Mínima</span>
                <strong className="summary-value">{moeda(chartData.minPrice)}</strong>
              </div>
            </div>

            <div className="quick-actions nested-card">
              <button className="quick-pill" type="button">💰 Comprar cotas</button>
              <button className="quick-pill" type="button">🧾 Criar ordem</button>
              <button className="quick-pill" type="button">📈 Comprar mercado</button>
              <button className="quick-pill" type="button">🔻 Vender mercado</button>
              <button className="quick-pill" type="button">📊 Ver livro</button>
            </div>
          </section>

          <section className="card chart-card">
            <h4>📈 Histórico de preço</h4>
            <p className="info-text">Linha simples baseada nas últimas negociações.</p>
            <div className="chart-wrap chart-wrap-highlight">
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="line-chart" role="img" aria-label="Gráfico de linha do histórico de preço">
                <polyline points={linePoints} fill="none" stroke="#53d7ff" strokeWidth="2.6" vectorEffect="non-scaling-stroke" />
              </svg>
              <div className="chart-meta">
                <div>
                  <span>Menor preço</span>
                  <strong>{moeda(chartData.minPrice)}</strong>
                </div>
                <div>
                  <span>Maior preço</span>
                  <strong>{moeda(chartData.maxPrice)}</strong>
                </div>
                <div>
                  <span>Último preço</span>
                  <strong>{moeda(chartData.lastPrice)}</strong>
                </div>
              </div>
            </div>
            {!chartData.hasRealHistory && <p className="warning">Ainda não há negociações suficientes para formar o gráfico.</p>}
          </section>

          <section className="card">
            <h4>🏦 Oferta inicial</h4>
            <p className="info-text">Compra direta de cotas ainda disponíveis da oferta inicial.</p>
            <form onSubmit={buyInitialOffer} className="form-grid">
              <input type="number" min="1" value={initialQty} onChange={(e) => setInitialQty(e.target.value)} placeholder="Quantidade de cotas" required />
              <button className="button-success" type="submit">
                💰 Comprar da oferta inicial
              </button>
            </form>
          </section>

          <section className="card">
            <h4>⚡ Ações de negociação</h4>
            <div className="quick-actions mode-pills">
              <button className="quick-pill" type="button">Comprar</button>
              <button className="quick-pill" type="button">Vender</button>
              <button className="quick-pill" type="button">Mercado</button>
              <button className="quick-pill" type="button">Limitada</button>
            </div>

            <div className="company-grid nested-card">
              <div className="card">
                <h5>💰 Criar ordem limitada</h5>
                <p className="info-text">Defina quantidade e preço para entrar no livro.</p>
                <form onSubmit={createLimitOrder} className="form-grid">
                  <select value={limitType} onChange={(e) => setLimitType(e.target.value as 'BUY' | 'SELL')}>
                    <option value="BUY">Comprar</option>
                    <option value="SELL">Vender</option>
                  </select>
                  <input type="number" min="1" value={limitQty} onChange={(e) => setLimitQty(e.target.value)} placeholder="Quantidade" required />
                  <input type="number" min="0.01" step="0.01" value={limitPrice} onChange={(e) => setLimitPrice(e.target.value)} placeholder="Preço limite" required />

                  {limitType === 'BUY' ? (
                    <div className="summary-item">
                      <p>
                        <strong>Resumo compra limitada</strong>
                      </p>
                      <p>Quantidade: {limitQtyN}</p>
                      <p>Preço limite por cota: {moeda(limitPriceN)}</p>
                      <p>Subtotal: {moeda(limitSubtotal)}</p>
                      <p>Taxa de compra: {buyFee}%</p>
                      <p>Total necessário: {moeda(limitTotalBuy)}</p>
                      <p>Saldo disponível: {moeda(walletBalance)}</p>
                    </div>
                  ) : (
                    <div className="summary-item">
                      <p>
                        <strong>Resumo venda limitada</strong>
                      </p>
                      <p>Quantidade: {limitQtyN}</p>
                      <p>Preço mínimo por cota: {moeda(limitPriceN)}</p>
                      <p>Subtotal esperado: {moeda(limitSubtotal)}</p>
                      <p>Taxa de venda: {sellFee}%</p>
                      <p>Total líquido estimado: {moeda(limitNetSell)}</p>
                      <p>Cotas disponíveis: {holdingQty}</p>
                    </div>
                  )}

                  <button className={limitType === 'BUY' ? 'button-success' : 'button-danger'} type="submit">
                    {limitType === 'BUY' ? '💰 Enviar compra limitada' : '🔻 Enviar venda limitada'}
                  </button>
                </form>
              </div>

              <div className="card">
                <h5>📈 Comprar a mercado</h5>
                <p className="info-text">Executa imediatamente nas melhores ofertas de venda.</p>
                <input type="number" min="1" value={marketBuyQty} onChange={(e) => setMarketBuyQty(e.target.value)} placeholder="Quantidade" />
                <input type="number" min="0" max="100" value={marketBuySlip} onChange={(e) => setMarketBuySlip(e.target.value)} placeholder="Slippage %" />
                <p>Melhor preço atual: {moeda(bestAsk)}</p>
                <p>Total estimado: {moeda((Number(marketBuyQty) || 0) * bestAsk * (1 + Number(marketBuySlip || '0') / 100))}</p>
                <button className="button-success" onClick={() => sendMarket('BUY')}>
                  Comprar a mercado
                </button>
              </div>

              <div className="card">
                <h5>🔻 Vender a mercado</h5>
                <p className="info-text">Executa imediatamente nas melhores ofertas de compra.</p>
                <input type="number" min="1" value={marketSellQty} onChange={(e) => setMarketSellQty(e.target.value)} placeholder="Quantidade" />
                <input type="number" min="0" max="100" value={marketSellSlip} onChange={(e) => setMarketSellSlip(e.target.value)} placeholder="Slippage %" />
                <p>Melhor comprador atual: {moeda(bestBid)}</p>
                <p>Total líquido estimado: {moeda((Number(marketSellQty) || 0) * bestBid * (1 - Number(selected.sellFeePercent) / 100))}</p>
                <button className="button-danger" onClick={() => sendMarket('SELL')}>
                  Vender a mercado
                </button>
              </div>
            </div>
          </section>

          <section className="card">
            <h4>📊 Livro de ofertas</h4>
            <p className="info-text">Vendas acima, preço atual no meio e compras abaixo.</p>
            <div className="order-book-stack">
              <div className="summary-item">
                <strong>🔻 Vendas</strong>
                {book.sellOrders.length === 0 ? (
                  <p className="info-text">Nenhuma oferta disponível ainda.</p>
                ) : (
                  book.sellOrders.map((order) => (
                    <p key={order.id}>
                      {moeda(Number(order.limitPrice ?? 0))} · {order.remainingQuantity} cotas
                    </p>
                  ))
                )}
              </div>

              <div className="summary-item order-price-center">
                <span className="summary-label">Preço atual</span>
                <strong className="summary-value">{moeda(Number(selected.currentPrice))}</strong>
              </div>

              <div className="summary-item">
                <strong>💰 Compras</strong>
                {book.buyOrders.length === 0 ? (
                  <p className="info-text">Nenhuma oferta disponível ainda.</p>
                ) : (
                  book.buyOrders.map((order) => (
                    <p key={order.id}>
                      {moeda(Number(order.limitPrice ?? 0))} · {order.remainingQuantity} cotas
                    </p>
                  ))
                )}
              </div>
            </div>
          </section>

          <section className="card">
            <h4>🧾 Minhas ordens</h4>
            <p className="info-text">No celular, visualize em cards; em telas maiores, mantenha tabela.</p>

            <div className="mobile-card-list">
              {myOrders.length === 0 && <p className="info-text">Você ainda não possui ordens nesta empresa.</p>}
              {myOrders.map((order) => (
                <article key={order.id} className="summary-item">
                  <p>
                    <strong>{order.type === 'BUY' ? '💰 Compra' : '🔻 Venda'}</strong> · {order.mode}
                  </p>
                  <p>Status: {order.status}</p>
                  <p>Quantidade: {order.quantity}</p>
                  <p>Restante: {order.remainingQuantity}</p>
                  <p>Preço: {order.limitPrice ? moeda(Number(order.limitPrice)) : '-'}</p>
                  {(order.status === 'OPEN' || order.status === 'PARTIALLY_FILLED') && order.mode === 'LIMIT' && (
                    <button className="button-danger" onClick={() => cancelOrder(order.id)}>
                      Cancelar ordem
                    </button>
                  )}
                </article>
              ))}
            </div>

            <div className="table-scroll desktop-only">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Tipo</th>
                    <th>Quantidade</th>
                    <th>Restante</th>
                    <th>Preço</th>
                    <th>Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {myOrders.length === 0 && (
                    <tr>
                      <td colSpan={6}>Você ainda não possui ordens nesta empresa.</td>
                    </tr>
                  )}
                  {myOrders.map((order) => (
                    <tr key={order.id}>
                      <td>{order.status}</td>
                      <td>
                        {order.mode} {order.type}
                      </td>
                      <td>{order.quantity}</td>
                      <td>{order.remainingQuantity}</td>
                      <td>{order.limitPrice ? moeda(Number(order.limitPrice)) : '-'}</td>
                      <td>
                        {(order.status === 'OPEN' || order.status === 'PARTIALLY_FILLED') && order.mode === 'LIMIT' ? (
                          <button onClick={() => cancelOrder(order.id)}>Cancelar</button>
                        ) : (
                          '-'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card">
            <h4>🧾 Últimas negociações</h4>
            <div className="mobile-card-list">
              {trades.length === 0 && <p className="info-text">Sem negociações registradas para esta empresa.</p>}
              {trades.map((trade) => (
                <article key={trade.id} className="summary-item compact-card">
                  <p>
                    <strong>Preço:</strong> {moeda(Number(trade.unitPrice))}
                  </p>
                  <p>
                    <strong>Quantidade:</strong> {trade.quantity}
                  </p>
                  <p>
                    <strong>Horário:</strong> {new Date(trade.createdAt).toLocaleString('pt-BR')}
                  </p>
                </article>
              ))}
            </div>

            <div className="table-scroll desktop-only">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Preço</th>
                    <th>Quantidade</th>
                    <th>Data/Hora</th>
                  </tr>
                </thead>
                <tbody>
                  {trades.length === 0 && (
                    <tr>
                      <td colSpan={3}>Sem negociações registradas para esta empresa.</td>
                    </tr>
                  )}
                  {trades.map((trade) => (
                    <tr key={trade.id}>
                      <td>{moeda(Number(trade.unitPrice))}</td>
                      <td>{trade.quantity}</td>
                      <td>{new Date(trade.createdAt).toLocaleString('pt-BR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
