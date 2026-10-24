'use client';

import {useEffect,useState} from 'react';
import {useLocale} from '@/lib/i18n-context';

type TickerItem={id:string;symbol:string;price:number;change?:number};

export default function HomeMarketTicker(){
  const {translate}=useLocale();
  const [items,setItems]=useState<TickerItem[]>([]);
  const [status,setStatus]=useState<'loading'|'ready'|'unavailable'>('loading');

  useEffect(()=>{
    let active=true;
    async function refresh(){
      try{
        const response=await fetch('/api/market',{cache:'no-store'});
        if(!response.ok)throw new Error('Market feed unavailable');
        const data=await response.json() as TickerItem[];
        if(!active)return;
        setItems(data.slice(0,8).map(item=>({...item,price:Number(item.price)})));
        setStatus('ready');
      }catch{if(active)setStatus(current=>current==='ready'?current:'unavailable')}
    }
    void refresh();
    const timer=window.setInterval(()=>void refresh(),4_000);
    return()=>{active=false;window.clearInterval(timer)};
  },[]);

  const row=items.map(item=>(
    <div className="ticker-item" key={item.id}>
      <span>{item.symbol}</span>
      <b>{item.price.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:item.price<10?4:2})}</b>
      <i className={item.change===undefined?'':item.change>=0?'ticker-positive':'ticker-negative'}>
        {item.change===undefined?'—':`${item.change>=0?'+':''}${(item.change*100).toFixed(2)}%`}
      </i>
    </div>
  ));

  return <div className="ticker-scroll is-live" aria-live="polite">
    <div className="ticker-track">
      <div className="ticker-items">{row}{!items.length&&<span className="ticker-empty">{status==='loading'?translate('loadingDemoInstruments'):status==='unavailable'?translate('demoMarketFeedUnavailable'):translate('noDemoInstrumentsConfigured')}</span>}</div>
      {items.length>0&&<div className="ticker-items" aria-hidden="true">{row}</div>}
    </div>
  </div>;
}
