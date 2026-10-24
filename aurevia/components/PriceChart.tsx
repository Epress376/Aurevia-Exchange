'use client';
import {useEffect,useState} from 'react';
import {LineChart,Line,XAxis,YAxis,Tooltip,ResponsiveContainer} from 'recharts';

type P={t:number;p:number};

export default function PriceChart({price,instrumentId,limit=40}:{price:number;instrumentId?:string;limit?:number}){
	const [data,setData]=useState<P[]>([]);

	useEffect(()=>{
		if(!instrumentId)return;
		let active=true;
		fetch(`/api/candles?instrumentId=${encodeURIComponent(instrumentId)}&limit=${limit}`,{cache:'no-store'}).then(async response=>{
			if(!response.ok)throw new Error('Candle data unavailable.');
			return response.json();
		}).then((candles:Array<{ts:string;close:string|number}>)=>{
			if(active)setData(candles.map(candle=>({t:new Date(candle.ts).getTime(),p:Number(candle.close)})));
		}).catch(()=>{if(active)setData([])});
		return()=>{active=false};
	},[instrumentId,limit]);

	useEffect(()=>{
		setData(current=>{
			const next=[...current,{t:Date.now(),p:price}];
			return next.slice(-(limit));
		});
	},[price,limit]);

	const stroke=data.length>=2&&data[data.length-1].p>=data[0].p?'#31c48d':'#d4a72c';

	return (
		<div className="price-chart-shell h-72 w-full">
			<ResponsiveContainer width="100%" height="100%">
				<LineChart data={data} margin={{top:8,right:8,left:0,bottom:0}}>
					<XAxis dataKey="t" hide/>
					<YAxis domain={['auto','auto']} tick={{fill:'#82918a',fontSize:11}} width={64} axisLine={false} tickLine={false}/>
					<Tooltip
						contentStyle={{background:'#0b1814',border:'1px solid rgba(212,167,44,.25)',borderRadius:10,fontSize:12}}
						labelStyle={{display:'none'}}
						formatter={value=>[value===undefined?'':Number(value).toLocaleString(undefined,{maximumFractionDigits:6}),'Price']}
					/>
					<Line type="monotone" dataKey="p" dot={false} stroke={stroke} strokeWidth={2.25} isAnimationActive={false}/>
				</LineChart>
			</ResponsiveContainer>
		</div>
	);
}
