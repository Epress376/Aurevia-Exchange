'use client';

import {useCallback,useEffect,useState} from 'react';
import {RefreshCw,TrendingDown,TrendingUp} from 'lucide-react';
import AdminNav from '@/components/AdminNav';

type Instrument={id:string;symbol:string;name:string;price:string|number;enabled:boolean;updatedAt:string};
type Direction='UP'|'DOWN';

export default function AdminMarkets(){
	const [instruments,setInstruments]=useState<Instrument[]>([]);
	const [symbol,setSymbol]=useState('BTC/USD');
	const [direction,setDirection]=useState<Direction>('UP');
	const [volatilityPercent,setVolatilityPercent]=useState('0.5');
	const [busy,setBusy]=useState(false);
	const [error,setError]=useState('');
	const [message,setMessage]=useState('');
	const load=useCallback(async()=>{
		try{
			const response=await fetch('/api/admin/instruments',{cache:'no-store'});
			const result=await response.json();
			if(!response.ok)throw new Error(result.error||'Unable to load market instruments.');
			setInstruments(result);
		}catch(exception){setError(exception instanceof Error?exception.message:'Unable to load market instruments.')}
	},[]);
	useEffect(()=>{void load()},[load]);

	async function updateMarket(){
		if(busy)return;
		setBusy(true);setError('');setMessage('');
		try{
			const response=await fetch('/api/admin/market/tick',{method:'POST',headers:{'content-type':'application/json','Idempotency-Key':crypto.randomUUID()},body:JSON.stringify({symbol,direction,volatilityPercent:Number(volatilityPercent)})});
			const result=await response.json();
			if(!response.ok)throw new Error(result.error||'Unable to update simulated market.');
			setMessage(`${result.symbol} simulation moved from ${result.previousPrice} to ${result.price}. Source: ${result.source}.`);
			await load();
		}catch(exception){setError(exception instanceof Error?exception.message:'Unable to update simulated market.')}
		finally{setBusy(false)}
	}

	return <><AdminNav/><main className="account-page">
		<header className="account-heading"><div><span className="account-kicker">ADMINISTRATION · MARKET OPERATIONS</span><h1>Market management</h1><p>Manage supported instruments and explicitly generated simulation-only price changes.</p></div><button type="button" className="icon-action" aria-label="Refresh market instruments" onClick={()=>void load()}><RefreshCw size={15}/></button></header>
		{message&&<p className="mb-3 text-sm text-profit" role="status">{message}</p>}{error&&<p className="mb-3 text-sm text-loss" role="alert">{error}</p>}
		<section className="account-panel card p-5">
			<div className="account-panel-title"><div><h2>Generate simulated market tick</h2><p className="account-panel-subtitle">Updates only the supported simulated instrument, records a candle and audit event, and processes eligible DEMO orders. It never writes a live provider quote.</p></div><span className="status-pill mode-demo">SIMULATION</span></div>
			<div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
				<label className="account-label">Instrument<select className="input min-h-11" value={symbol} onChange={event=>setSymbol(event.target.value)}>{['NVDA','BTC/USD','XAU/USD'].map(value=><option key={value}>{value}</option>)}</select></label>
				<label className="account-label">Direction<select className="input min-h-11" value={direction} onChange={event=>setDirection(event.target.value as Direction)}><option value="UP">UP</option><option value="DOWN">DOWN</option></select></label>
				<label className="account-label">Volatility (%)<input className="input min-h-11" type="number" min="0.01" max="25" step="0.01" value={volatilityPercent} onChange={event=>setVolatilityPercent(event.target.value)}/></label>
				<div className="flex items-end"><button type="button" disabled={busy} className="btn min-h-11 w-full bg-gold text-black disabled:opacity-50" onClick={()=>void updateMarket()}>{direction==='UP'?<TrendingUp size={15}/>:<TrendingDown size={15}/>} {busy?'Updating…':'Generate simulated tick'}</button></div>
			</div>
		</section>
		<section className="account-panel card mt-4 p-5"><div className="account-panel-title"><div><h2>Supported instruments</h2><p className="account-panel-subtitle">Current stored simulation marks; not current market quotations.</p></div></div>
			{instruments.length?<div className="account-table-wrap"><table className="account-table"><thead><tr><th>Symbol</th><th>Instrument</th><th>Stored simulation mark</th><th>Status</th><th>Last changed</th></tr></thead><tbody>{instruments.filter(item=>['NVDA','BTC/USD','XAU/USD'].includes(item.symbol)).map(item=><tr key={item.id}><td>{item.symbol}</td><td>{item.name}</td><td>{Number(item.price).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:8})}</td><td>{item.enabled?'Enabled':'Disabled'}</td><td>{new Date(item.updatedAt).toLocaleString()}</td></tr>)}</tbody></table></div>:<p className="account-empty">Loading supported instruments…</p>}
		</section>
	</main></>;
}
