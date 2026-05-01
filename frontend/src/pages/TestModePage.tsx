import { useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';

type Wallet = { fiatBalance: string; rpcBalance: string };
type Market = { currentPrice: string };

export function TestModePage() {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [market, setMarket] = useState<Market | null>(null);
  const [fiatAmount, setFiatAmount] = useState('100');
  const [rpcAmount, setRpcAmount] = useState('10');
  const [message, setMessage] = useState('');

  async function load() {
    try {
      const [w, m] = await Promise.all([api<Wallet>('/test-mode/me'), api<Market>('/test-mode/market')]);
      setWallet(w); setMarket(m);
    } catch (e) { setMessage((e as Error).message); }
  }
  useEffect(() => { void load(); }, []);
  const total = useMemo(() => wallet && market ? Number(wallet.fiatBalance) + Number(wallet.rpcBalance) * Number(market.currentPrice) : 0, [wallet, market]);

  return <section className="card"><h2>🧪 Modo Teste da RPC Exchange</h2><p className="warning">Modo Teste ativo. As operações desta tela não afetam a Exchange principal.</p>
  <p>Saldo teste R$: {wallet?.fiatBalance ?? '-'}</p><p>Saldo teste RPC: {wallet?.rpcBalance ?? '-'}</p><p>Patrimônio estimado: R$ {total.toFixed(2)}</p><p>Preço atual RPC/R$: {market?.currentPrice ?? '-'}</p>
  <div><input value={fiatAmount} onChange={(e)=>setFiatAmount(e.target.value)} /><button onClick={async()=>{await api('/test-mode/buy',{method:'POST',body:JSON.stringify({fiatAmount:Number(fiatAmount)})}); await load(); setMessage('Compra de teste realizada.');}}>Comprar RPC de teste</button></div>
  <div><input value={rpcAmount} onChange={(e)=>setRpcAmount(e.target.value)} /><button onClick={async()=>{await api('/test-mode/sell',{method:'POST',body:JSON.stringify({rpcAmount:Number(rpcAmount)})}); await load(); setMessage('Venda de teste realizada.');}}>Vender RPC de teste</button></div>
  <button onClick={async()=>{await api('/test-mode/reports',{method:'POST',body:JSON.stringify({type:'BUG',location:'TestModePage',description:'Report manual'})}); setMessage('Report enviado.');}}>🐞 Reportar erro / trapaça</button>
  {message && <p>{message}</p>}</section>;
}
