'use client';

import {useCallback,useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {useSession} from 'next-auth/react';
import {ArrowLeftRight,RefreshCw,ShieldCheck} from 'lucide-react';
import Nav from '@/components/Nav';

type WalletResponse={accountMode:'DEMO'|'REAL';balance:string|number|null;balances:Array<{currency:string;balance:string|number}>};
type BitcoinQuote={symbol:string;price:number|string;takerFee:number|string;updatedAt:string;source:string;dataMode:'SIMULATED'|'LIVE'};
const usd=(value:number)=>value.toLocaleString(undefined,{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2});
const btc=(value:number)=>`${value.toLocaleString(undefined,{minimumFractionDigits:0,maximumFractionDigits:10})} BTC`;

export default function BitcoinConversionExperience(){
	const {status}=useSession();
	const [wallet,setWallet]=useState<WalletResponse|null>(null);
	const [quote,setQuote]=useState<BitcoinQuote|null>(null);
	const [direction,setDirection]=useState<'BUY'|'SELL'>('BUY');
	const [amount,setAmount]=useState('');
	const [confirming,setConfirming]=useState(false);
	const [requestKey,setRequestKey]=useState('');
	const [loading,setLoading]=useState(true);
	const [submitting,setSubmitting]=useState(false);
	const [error,setError]=useState('');
	const [message,setMessage]=useState('');
	const [now,setNow]=useState(0);

	const load=useCallback(async()=>{
		setLoading(true);
		try{
			const [walletResponse,marketResponse]=await Promise.all([fetch('/api/wallet',{cache:'no-store'}),fetch('/api/market',{cache:'no-store'})]);
			const [walletResult,marketResult]=await Promise.all([walletResponse.json(),marketResponse.json()]);
			if(!walletResponse.ok)throw new Error(walletResult.error||'Account balance is unavailable.');
			if(!marketResponse.ok)throw new Error(marketResult.error||'Simulated market data is unavailable.');
			const market=marketResult.find((item:BitcoinQuote)=>item.symbol==='BTC/USD'&&item.dataMode==='SIMULATED');
			if(!market)throw new Error('The simulated BTC/USD reference price is unavailable.');
			setWallet(walletResult);setQuote(market);setError('');
		}catch(exception){setError(exception instanceof Error?exception.message:'Unable to load conversion details.');}
		finally{setLoading(false);}
	},[]);
	useEffect(()=>{if(status==='authenticated')void load()},[status,load]);
	useEffect(()=>{setNow(Date.now());const timer=window.setInterval(()=>setNow(Date.now()),1000);return()=>window.clearInterval(timer)},[]);

	const cash=Number(wallet?.balances.find(item=>item.currency==='USD')?.balance??0);
	const bitcoinBalance=Number(wallet?.balances.find(item=>item.currency==='BTC')?.balance??0);
	const price=Number(quote?.price??0);
	const feeRate=Number(quote?.takerFee??0);
	const parsedAmount=Number(amount);
	const fee=useMemo(()=>direction==='BUY'?parsedAmount*feeRate:parsedAmount*price*feeRate, [direction,parsedAmount,feeRate,price]);
	const bitcoinEstimate=useMemo(()=>direction==='BUY'&&price>0?(parsedAmount-fee)/price:parsedAmount,[direction,parsedAmount,fee,price]);
	const availableAfter=direction==='BUY'?cash-parsedAmount:cash+Math.max(0,parsedAmount*price-fee);
	const quoteAt=quote?new Date(quote.updatedAt).getTime():0;
	const quoteStale=!quoteAt||now===0||now-quoteAt>30_000||quoteAt-now>5_000;
	const validAmount=Number.isFinite(parsedAmount)&&parsedAmount>0&&(!quoteStale)&& (direction==='BUY'?parsedAmount<=cash&&parsedAmount>=0.01:parsedAmount<=bitcoinBalance);

	function preview(event:React.FormEvent<HTMLFormElement>){
		event.preventDefault();setMessage('');setError('');
		if(wallet?.accountMode!=='DEMO'){setError('Virtual Bitcoin conversion is only available in the DEMO account.');return;}
		if(!validAmount){setError(direction==='BUY'?'Enter an amount within your available DEMO USD balance.':'Enter an amount within your available simulated BTC balance.');return;}
		setRequestKey(window.crypto.randomUUID());setConfirming(true);
	}
	async function confirm(){
		if(!requestKey||submitting)return;
		setSubmitting(true);setError('');
		try{
			const response=await fetch('/api/wallet/convert-bitcoin',{method:'POST',headers:{'content-type':'application/json','Idempotency-Key':requestKey},body:JSON.stringify({direction,amount})});
			const result=await response.json();
			if(!response.ok)throw new Error(result.error||'Conversion could not be completed.');
			setMessage(`SIMULATED conversion complete. Reference: ${result.reference}`);
			setAmount('');setConfirming(false);setRequestKey('');
			await load();
		}catch(exception){setError(exception instanceof Error?exception.message:'Conversion failed. Retry with the same confirmation.');}
		finally{setSubmitting(false);}
	}

	return <><Nav/><main className="account-page">
		<Link className="text-link inline-flex items-center gap-2" href="/wallet"><ArrowLeftRight size={15}/> Back to account funds</Link>
		<header className="account-heading mt-4"><div><span className="account-kicker">DEMO ACCOUNT · SIMULATED ASSETS</span><h1>Convert USD and virtual BTC</h1><p>Practice conversion at the simulated BTC/USD mark price. No real cryptocurrency is purchased or transferred.</p></div><span className="status-pill mode-demo">SIMULATED</span></header>
		<section className="card mt-5 p-5 sm:p-7">
			<div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">DEMO conversion</h2><p className="mt-1 text-sm muted">Available cash: {loading?'Loading…':usd(cash)} · Virtual BTC: {loading?'Loading…':btc(bitcoinBalance)}</p></div><button className="btn min-h-11 bg-white/5" type="button" disabled={loading} onClick={()=>void load()}><RefreshCw size={15}/>Refresh quote</button></div>
			<div className="mt-4 rounded-lg border border-amber-400/20 bg-amber-300/5 p-4"><p className="text-sm font-semibold">SIMULATED MARKET · BTC/USD {price>0?usd(price):'Unavailable'}</p><p className="mt-1 text-xs muted">{quote?.source||'No source'} · {quote?.updatedAt?`Updated ${new Date(quote.updatedAt).toLocaleString()}`:'No quote timestamp'} · This reference price is not a live quotation.</p><p className="mt-1 text-xs muted">Execution uses the current simulated BTC/USD mark with zero additional spread and the instrument’s configured simulated taker fee ({(feeRate*100).toFixed(4)}%).</p></div>
			{wallet?.accountMode==='REAL'&&<p className="account-callout mt-4" role="status">Switch to the DEMO account to use simulated conversions. REAL settled balances cannot be used to acquire virtual BTC.</p>}
			<form className="mt-5 grid gap-4" onSubmit={preview}>
				<label className="block text-sm">Conversion direction<select className="input mt-1 min-h-11" value={direction} onChange={event=>{setDirection(event.target.value as 'BUY'|'SELL');setAmount('');setConfirming(false);setRequestKey('')}}><option value="BUY">Convert USD to virtual BTC</option><option value="SELL">Sell virtual BTC to DEMO USD</option></select></label>
				<label className="block text-sm">{direction==='BUY'?'USD amount':'BTC amount'}<input className="input mt-1 min-h-11" type="number" min={direction==='BUY'?'0.01':'0.0000000001'} max={direction==='BUY'?cash:bitcoinBalance} step={direction==='BUY'?'0.01':'0.0000000001'} inputMode="decimal" value={amount} onChange={event=>{setAmount(event.target.value);setConfirming(false);setRequestKey('')}} required/></label>
				{!quoteStale&&price>0&&Number.isFinite(parsedAmount)&&parsedAmount>0&&<dl className="grid gap-2 rounded-lg bg-white/[0.03] p-4 text-sm sm:grid-cols-2"><div><dt className="muted">Estimated fee</dt><dd>{usd(fee)}</dd></div><div><dt className="muted">Execution price</dt><dd>{usd(price)} per BTC · simulated</dd></div><div><dt className="muted">{direction==='BUY'?'Estimated virtual BTC':'BTC sold'}</dt><dd>{btc(bitcoinEstimate)}</dd></div><div><dt className="muted">Estimated cash after conversion</dt><dd>{usd(availableAfter)}</dd></div></dl>}
				{quoteStale&&<p className="text-sm text-loss" role="alert">The simulated reference price is stale. Refresh the quote before continuing.</p>}
				{error&&<p className="text-sm text-loss" role="alert">{error}</p>}
				{message&&<p className="text-sm text-profit" role="status">{message}</p>}
				{!confirming?<button className="btn min-h-11 w-full bg-gold text-black sm:w-fit" type="submit" disabled={loading||wallet?.accountMode!=='DEMO'||!validAmount}>Review simulated conversion</button>:<div className="rounded-lg border border-gold/30 p-4" role="group" aria-label="Confirm simulated conversion"><p className="font-semibold">Confirm SIMULATED {direction==='BUY'?'USD to BTC':'BTC to USD'} conversion</p><p className="mt-2 text-sm muted">{direction==='BUY'?`${usd(parsedAmount)} USD for approximately ${btc(bitcoinEstimate)}`:`${btc(parsedAmount)} for approximately ${usd(availableAfter-cash)}`} · Fee {usd(fee)} · {usd(price)} / BTC.</p><p className="mt-1 text-xs muted">This only changes the DEMO ledger. The BTC is virtual, not withdrawable, and is not sent to a blockchain.</p><div className="mt-4 flex flex-wrap gap-2"><button className="btn min-h-11 bg-gold text-black" type="button" disabled={submitting||quoteStale} aria-busy={submitting} onClick={()=>void confirm()}><ShieldCheck size={15}/>{submitting?'Processing…':'Confirm simulated conversion'}</button><button className="btn min-h-11 bg-white/5" type="button" disabled={submitting} onClick={()=>{setConfirming(false);setRequestKey('')}}>Cancel</button></div></div>}
			</form>
		</section>
	</main></>;
}
