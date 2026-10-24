'use client';

import {useEffect,useState} from 'react';

type MarketTickerItem={symbol:string;price:number;change?:number};

export default function MarketTicker({initial}:{initial:MarketTickerItem[]}){
	const [markets,setMarkets]=useState(initial);
	useEffect(()=>{
		let active=true;
		async function refresh(){
			try{
				const response=await fetch('/api/market',{cache:'no-store'});
				if(!response.ok)return;
				const updates=await response.json() as MarketTickerItem[];
				if(active)setMarkets(updates.map(item=>({...item,price:Number(item.price)})));
			}catch{}
		}
		const timer=window.setInterval(()=>void refresh(),15_000);
		return()=>{active=false;window.clearInterval(timer)};
	},[]);
	return <div className="market-ticker-track" aria-label="Configured simulated market instruments">{markets.map(market=><article key={market.symbol} className="market-ticker-card"><div className="market-ticker-head"><span>{market.symbol}</span><small>SIM</small></div><b>{market.price.toLocaleString(undefined,{maximumFractionDigits:4})}</b>{market.change===undefined?<span className="market-ticker-source">Simulated price</span>:<span className={`market-ticker-change ${market.change>=0?'is-up':'is-down'}`}>Last tick {market.change>=0?'+':''}{(market.change*100).toFixed(2)}%</span>}</article>)}</div>;
}
