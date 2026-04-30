import { FormEvent, useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';

type MarketState = { currentPrice: string; fiatReserve: string; rpcReserve: string; totalFiatVolume: string; totalRpcVolume: string; totalBuys: number; totalSells: number; updatedAt: string; };
type Trade = { id: string; side: 'BUY_RPC' | 'SELL_RPC'; fiatAmount: string; rpcAmount: string; unitPrice: string; priceBefore: string; priceAfter: string; createdAt: string; };
type BuyQuote = { estimatedRpcAmount: string; effectiveUnitPrice: string };
type SellQuote = { estimatedFiatAmount: string; effectiveUnitPrice: string };

export function RpcMarketPage() {
  const [market, setMarket] = useState<MarketState | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [wallet, setWallet] = useState<{ fiatAvailableBalance: string; rpcAvailableBalance: string } | null>(null);
  const [fiatAmount, setFiatAmount] = useState('');
  const [rpcAmount, setRpcAmount] = useState('');
  const [buyQuote, setBuyQuote] = useState<BuyQuote | null>(null);
  const [sellQuote, setSellQuote] = useState<SellQuote | null>(null);
  const [quoteError, setQuoteError] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function load() {
    const [marketData, tradesData, me] = await Promise.all([
      api<MarketState>('/rpc-market'), api<{ trades: Trade[] }>('/rpc-market/trades?limit=30'), api<{ wallet: { fiatAvailableBalance: string; rpcAvailableBalance: string } }>('/auth/me'),
    ]);
    setMarket(marketData); setTrades(tradesData.trades); setWallet(me.wallet);
  }

  useEffect(() => { load().catch((err: Error) => setError(err.message)); }, []);

  useEffect(() => {
    const id = setTimeout(async () => {
      if (!fiatAmount || Number(fiatAmount) < 0.01) return setBuyQuote(null);
      try {
        const quote = await api<BuyQuote>(`/rpc-market/quote-buy?fiatAmount=${encodeURIComponent(fiatAmount)}`);
        setBuyQuote(quote); setQuoteError('');
      } catch (err) { setBuyQuote(null); setQuoteError((err as Error).message); }
    }, 250);
    return () => clearTimeout(id);
  }, [fiatAmount]);

  useEffect(() => {
    const id = setTimeout(async () => {
      if (!rpcAmount || Number(rpcAmount) < 0.01) return setSellQuote(null);
      try {
        const quote = await api<SellQuote>(`/rpc-market/quote-sell?rpcAmount=${encodeURIComponent(rpcAmount)}`);
        setSellQuote(quote); setQuoteError('');
      } catch (err) { setSellQuote(null); setQuoteError((err as Error).message); }
    }, 250);
    return () => clearTimeout(id);
  }, [rpcAmount]);

  const variation = useMemo(() => {
    if (!trades.length) return 0; const last = trades[0]; const before = Number(last.priceBefore); const after = Number(last.priceAfter); if (!before) return 0; return ((after - before) / before) * 100;
  }, [trades]);

  async function onBuy(event: FormEvent) {
    event.preventDefault();
    setError('');
    setMessage('');
    try {
      const response = await api<{ message: string }>('/rpc-market/buy', { method: 'POST', body: JSON.stringify({ fiatAmount }) });
      setMessage(response.message);
      setFiatAmount('');
      setBuyQuote(null);
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
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <section className="card">
      <h2>💴 RPC/R$</h2>
      <p className="info-text">Preço atual: R$ {Number(market?.currentPrice ?? 0).toFixed(8)}</p>
      <p className="info-text">Variação último trade: <strong style={{ color: variation >= 0 ? '#16a34a' : '#dc2626' }}>{variation.toFixed(2)}%</strong></p>
      {error && <p className="status-message error">{error}</p>}
      {message && <p className="status-message">{message}</p>}
      {quoteError && <p className="info-text">Não foi possível atualizar a cotação agora: {quoteError}</p>}

      <div className="summary-grid nested-card">
        <div className="summary-item"><span className="summary-label">Saldo R$</span><strong className="summary-value">{Number(wallet?.fiatAvailableBalance ?? 0).toFixed(2)}</strong></div>
        <div className="summary-item"><span className="summary-label">Saldo RPC</span><strong className="summary-value">{Number(wallet?.rpcAvailableBalance ?? 0).toFixed(2)}</strong></div>
      </div>

      <div className="home-grid nested-card">
        <form onSubmit={onBuy} className="form-grid">
          <h3>Comprar RPC</h3>
          <input value={fiatAmount} onChange={(e) => setFiatAmount(e.target.value)} placeholder="Valor em R$" required />
          <p className="info-text">Você receberá aproximadamente {Number(buyQuote?.estimatedRpcAmount ?? 0).toFixed(2)} RPC</p>
          <p className="info-text">Preço médio estimado: R$ {Number(buyQuote?.effectiveUnitPrice ?? 0).toFixed(8)}</p>
          <button className="button-primary" type="submit" disabled={!buyQuote || Number(fiatAmount) < 0.01}>Comprar RPC</button>
        </form>

        <form onSubmit={onSell} className="form-grid">
          <h3>Vender RPC</h3>
          <input value={rpcAmount} onChange={(e) => setRpcAmount(e.target.value)} placeholder="Quantidade RPC" required />
          <p className="info-text">Você receberá aproximadamente R$ {Number(sellQuote?.estimatedFiatAmount ?? 0).toFixed(2)}</p>
          <p className="info-text">Preço médio estimado: R$ {Number(sellQuote?.effectiveUnitPrice ?? 0).toFixed(8)}</p>
          <button className="button-primary" type="submit" disabled={!sellQuote || Number(rpcAmount) < 0.01}>Vender RPC</button>
        </form>
      </div>

      <h3 className="nested-card">Gráfico básico de preço</h3>
      <div className="mobile-card-list nested-card">
        {trades.length === 0 && <p className="empty-state">Sem trades ainda. Preço inicial: R$ {Number(market?.currentPrice ?? 1).toFixed(8)}</p>}
        {trades.slice(0, 10).map((trade) => <p key={trade.id}>{new Date(trade.createdAt).toLocaleTimeString('pt-BR')} — R$ {Number(trade.priceAfter).toFixed(8)}</p>)}
      </div>
    </section>
  );
}
