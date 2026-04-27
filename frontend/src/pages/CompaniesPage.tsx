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

function moeda(value: number) {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
      setMessage('Compra da oferta inicial realizada com sucesso.');
      await refreshSelected(selected.id);
    } catch (err) {
      setError((err as Error).message);
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
      setMessage('Ordem limitada criada e enviada para o livro.');
      await refreshSelected(selected.id);
    } catch (err) {
      setError((err as Error).message);
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
      await refreshSelected(selected.id);
    } catch (err) {
      setError((err as Error).message);
      setMessage('');
    }
  }

  async function cancelOrder(orderId: string) {
    if (!selected) return;
    try {
      await api(`/market/orders/${orderId}/cancel`, { method: 'POST' });
      setMessage('Ordem cancelada e recursos liberados.');
      await refreshSelected(selected.id);
    } catch (err) {
      setError((err as Error).message);
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

  return (
    <section className="card">
      <h2>Empresas e Mercado Secundário</h2>
      {error && <p>{error}</p>}
      {message && <p>{message}</p>}

      <ul>
        {companies.map((company) => (
          <li key={company.id}>
            <strong>{company.name}</strong> ({company.ticker}) — Preço inicial: {company.initialPrice}
            <button onClick={() => selectCompany(company.id)}>Detalhes</button>
          </li>
        ))}
      </ul>

      {selectedId && selected && (
        <div className="card nested-card">
          <h3>{selected.name} ({selected.ticker})</h3>
          <p>{selected.description}</p>
          <p>Saldo disponível: {moeda(walletBalance)} moedas | Suas cotas: {holdingQty}</p>

          <div className="card nested-card">
            <h4>Oferta inicial (Fase anterior preservada)</h4>
            <form onSubmit={buyInitialOffer} className="form-grid">
              <input type="number" min="1" value={initialQty} onChange={(e) => setInitialQty(e.target.value)} placeholder="Quantidade de cotas" required />
              <button type="submit">Comprar da oferta inicial</button>
            </form>
          </div>

          <div className="grid-two">
            <div className="card nested-card">
              <h4>Livro de ofertas (compra)</h4>
              {book.buyOrders.map((order) => (
                <p key={order.id}>Preço: {order.limitPrice} | Qtde: {order.remainingQuantity} | Total: {moeda(Number(order.limitPrice ?? 0) * order.remainingQuantity)}</p>
              ))}
            </div>
            <div className="card nested-card">
              <h4>Livro de ofertas (venda)</h4>
              {book.sellOrders.map((order) => (
                <p key={order.id}>Preço: {order.limitPrice} | Qtde: {order.remainingQuantity} | Total: {moeda(Number(order.limitPrice ?? 0) * order.remainingQuantity)}</p>
              ))}
            </div>
          </div>

          <div className="card nested-card">
            <h4>Nova ordem limitada</h4>
            <form onSubmit={createLimitOrder} className="form-grid">
              <select value={limitType} onChange={(e) => setLimitType(e.target.value as 'BUY' | 'SELL')}>
                <option value="BUY">Comprar</option>
                <option value="SELL">Vender</option>
              </select>
              <input type="number" min="1" value={limitQty} onChange={(e) => setLimitQty(e.target.value)} placeholder="Quantidade" required />
              <input type="number" min="0.01" step="0.01" value={limitPrice} onChange={(e) => setLimitPrice(e.target.value)} placeholder="Preço limite" required />

              {limitType === 'BUY' ? (
                <div>
                  <p><strong>Resumo compra limitada</strong></p>
                  <p>Quantidade: {limitQtyN}</p>
                  <p>Preço limite por cota: {moeda(limitPriceN)}</p>
                  <p>Subtotal: {moeda(limitSubtotal)}</p>
                  <p>Taxa de compra: {buyFee}%</p>
                  <p>Total necessário: {moeda(limitTotalBuy)}</p>
                  <p>Saldo disponível: {moeda(walletBalance)}</p>
                  <p>Saldo que será bloqueado: {moeda(limitTotalBuy)}</p>
                </div>
              ) : (
                <div>
                  <p><strong>Resumo venda limitada</strong></p>
                  <p>Quantidade: {limitQtyN}</p>
                  <p>Preço mínimo por cota: {moeda(limitPriceN)}</p>
                  <p>Subtotal esperado: {moeda(limitSubtotal)}</p>
                  <p>Taxa de venda: {sellFee}%</p>
                  <p>Total líquido estimado: {moeda(limitNetSell)}</p>
                  <p>Cotas disponíveis: {holdingQty}</p>
                  <p>Cotas que serão bloqueadas: {limitQtyN}</p>
                </div>
              )}

              <button type="submit">Criar ordem limitada</button>
            </form>
          </div>

          <div className="grid-two">
            <div className="card nested-card">
              <h4>Compra a mercado</h4>
              <input type="number" min="1" value={marketBuyQty} onChange={(e) => setMarketBuyQty(e.target.value)} placeholder="Quantidade" />
              <input type="number" min="0" max="100" value={marketBuySlip} onChange={(e) => setMarketBuySlip(e.target.value)} placeholder="Slippage %" />
              <p>Quantidade desejada: {Number(marketBuyQty) || 0}</p>
              <p>Melhor preço atual: {moeda(bestAsk)}</p>
              <p>Preço estimado: {moeda((Number(marketBuyQty) || 0) * bestAsk)}</p>
              <p>Slippage máximo: {marketBuySlip}%</p>
              <p>Total estimado: {moeda((Number(marketBuyQty) || 0) * bestAsk * (1 + Number(marketBuySlip || '0') / 100))}</p>
              <button onClick={() => sendMarket('BUY')}>Comprar a mercado</button>
            </div>

            <div className="card nested-card">
              <h4>Venda a mercado</h4>
              <input type="number" min="1" value={marketSellQty} onChange={(e) => setMarketSellQty(e.target.value)} placeholder="Quantidade" />
              <input type="number" min="0" max="100" value={marketSellSlip} onChange={(e) => setMarketSellSlip(e.target.value)} placeholder="Slippage %" />
              <p>Quantidade desejada: {Number(marketSellQty) || 0}</p>
              <p>Melhor comprador atual: {moeda(bestBid)}</p>
              <p>Slippage máximo: {marketSellSlip}%</p>
              <p>Total líquido estimado: {moeda((Number(marketSellQty) || 0) * bestBid * (1 - Number(selected.sellFeePercent) / 100))}</p>
              <button onClick={() => sendMarket('SELL')}>Vender a mercado</button>
            </div>
          </div>

          <div className="card nested-card">
            <h4>Minhas ordens</h4>
            {myOrders.map((order) => (
              <p key={order.id}>
                [{order.status}] {order.mode} {order.type} | Qtd: {order.quantity} | Restante: {order.remainingQuantity} | Preço: {order.limitPrice ?? '-'}
                {(order.status === 'OPEN' || order.status === 'PARTIALLY_FILLED') && order.mode === 'LIMIT' && (
                  <button onClick={() => cancelOrder(order.id)}>Cancelar</button>
                )}
              </p>
            ))}
          </div>

          <div className="card nested-card">
            <h4>Últimas negociações</h4>
            {trades.map((trade) => (
              <p key={trade.id}>Preço: {trade.unitPrice} | Quantidade: {trade.quantity} | {new Date(trade.createdAt).toLocaleString('pt-BR')}</p>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
