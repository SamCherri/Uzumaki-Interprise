import { formatCurrency, formatPercent, formatPrice } from '../utils/formatters';

export type OrderBookRow = {
  id?: string;
  price: number;
  quantity: number;
  total?: number;
};

type OrderBookProps = {
  buyOrders: OrderBookRow[];
  sellOrders: OrderBookRow[];
  currentPrice?: number;
  quoteSymbol?: string;
  baseSymbol?: string;
  maxRows?: number;
  emptyMessage?: string;
};

function toSafeNumber(value: number) {
  return Number.isFinite(value) ? value : 0;
}

export function OrderBook({
  buyOrders,
  sellOrders,
  currentPrice,
  quoteSymbol = 'R$',
  baseSymbol = '',
  maxRows = 8,
  emptyMessage = 'Sem ordens no livro neste momento.',
}: OrderBookProps) {
  const visibleBuys = [...buyOrders].slice(0, maxRows);
  const visibleSells = [...sellOrders].slice(0, maxRows);

  const bestAsk = visibleSells.length > 0 ? Math.min(...visibleSells.map((order) => order.price)) : null;
  const bestBid = visibleBuys.length > 0 ? Math.max(...visibleBuys.map((order) => order.price)) : null;
  const spreadAbs = bestAsk !== null && bestBid !== null ? bestAsk - bestBid : null;
  const spreadPercent = spreadAbs !== null && bestBid !== null && bestBid > 0 ? (spreadAbs / bestBid) * 100 : null;

  const maxBuyDepth = Math.max(0, ...visibleBuys.map((order) => toSafeNumber(order.total ?? order.price * order.quantity)));
  const maxSellDepth = Math.max(0, ...visibleSells.map((order) => toSafeNumber(order.total ?? order.price * order.quantity)));

  const renderRow = (row: OrderBookRow, side: 'buy' | 'sell', maxDepth: number) => {
    const total = toSafeNumber(row.total ?? row.price * row.quantity);
    const depthPercent = maxDepth > 0 ? Math.max(6, Math.min(100, Math.round((total / maxDepth) * 100))) : 0;
    const rowClass = side === 'buy' ? 'order-book-buy' : 'order-book-sell';

    return (
      <tr key={row.id ?? `${side}-${row.price}-${row.quantity}`} className={`order-book-row ${rowClass}`}>
        <td className="order-book-cell order-book-price">{quoteSymbol} {formatPrice(row.price)}</td>
        <td className="order-book-cell">{formatCurrency(row.quantity)} {baseSymbol}</td>
        <td className="order-book-cell">{formatCurrency(total)}</td>
        <td className="order-book-depth" style={{ width: `${depthPercent}%` }} aria-hidden="true" />
      </tr>
    );
  };

  const hasBook = visibleBuys.length > 0 || visibleSells.length > 0;

  return (
    <div className="order-book">
      {!hasBook && <p className="order-book-empty">{emptyMessage}</p>}
      {hasBook && (
        <>
          <div className="order-book-section">
            <h5>Vendas</h5>
            <table className="order-book-table">
              <thead><tr><th>Preço</th><th>Quantidade</th><th>Total</th></tr></thead>
              <tbody>{visibleSells.length === 0 ? <tr><td colSpan={3} className="order-book-empty">Sem vendas</td></tr> : visibleSells.map((order) => renderRow(order, 'sell', maxSellDepth))}</tbody>
            </table>
          </div>

          <div className="order-book-spread">
            {spreadAbs === null || spreadPercent === null ? (
              <strong>Spread indisponível</strong>
            ) : (
              <strong>Spread: {quoteSymbol} {formatPrice(spreadAbs)} / {formatPercent(spreadPercent)}%</strong>
            )}
            {currentPrice !== undefined && Number.isFinite(currentPrice) && (
              <p className="order-book-current-price">Preço atual: {quoteSymbol} {formatPrice(currentPrice)}</p>
            )}
          </div>

          <div className="order-book-section">
            <h5>Compras</h5>
            <table className="order-book-table">
              <thead><tr><th>Preço</th><th>Quantidade</th><th>Total</th></tr></thead>
              <tbody>{visibleBuys.length === 0 ? <tr><td colSpan={3} className="order-book-empty">Sem compras</td></tr> : visibleBuys.map((order) => renderRow(order, 'buy', maxBuyDepth))}</tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
