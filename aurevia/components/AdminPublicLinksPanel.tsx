'use client';

import {useCallback,useEffect,useState} from 'react';
import {ExternalLink,Plus,Save,Trash2} from 'lucide-react';

type LinkRow={id:string;title:string;url:string;description?:string};

function blank():LinkRow{
	return {id:crypto.randomUUID(),title:'',url:'',description:''};
}

export default function AdminPublicLinksPanel(){
	const [links,setLinks]=useState<LinkRow[]>([]);
	const [loading,setLoading]=useState(true);
	const [busy,setBusy]=useState(false);
	const [error,setError]=useState('');
	const [message,setMessage]=useState('');

	const load=useCallback(async()=>{
		setLoading(true);
		try{
			const response=await fetch('/api/admin/public-links',{cache:'no-store'});
			const result=await response.json();
			if(!response.ok)throw new Error(result.error||'Unable to load links.');
			setLinks(Array.isArray(result.links)?result.links:[]);
			setError('');
		}catch(exception){setError(exception instanceof Error?exception.message:'Unable to load links.');}
		finally{setLoading(false)}
	},[]);

	useEffect(()=>{void load()},[load]);

	async function save(){
		if(busy)return;
		setBusy(true);setError('');setMessage('');
		try{
			const payload=links.filter(link=>link.title.trim()&&link.url.trim()).map(link=>({
				id:link.id,
				title:link.title.trim(),
				url:link.url.trim(),
				...(link.description?.trim()?{description:link.description.trim()}:{}),
			}));
			const response=await fetch('/api/admin/public-links',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({links:payload})});
			const result=await response.json();
			if(!response.ok)throw new Error(result.error||'Unable to save links.');
			setLinks(result.links||payload);
			setMessage('Links published for all visitors.');
		}catch(exception){setError(exception instanceof Error?exception.message:'Unable to save links.');}
		finally{setBusy(false)}
	}

	return (
		<section className="card mt-4 p-4 sm:p-5">
			<header className="flex flex-wrap items-start justify-between gap-3">
				<div>
					<h2 className="font-bold">Resource links</h2>
					<p className="muted mt-1 text-sm">Titles and URLs shown to signed-in users and guests. Include a link back to the Aurevia home page if needed.</p>
				</div>
				<button type="button" className="btn bg-gold text-black" disabled={busy} onClick={()=>void save()}><Save size={14}/>{busy?'Saving…':'Save & publish'}</button>
			</header>
			{error&&<p className="mt-3 text-sm text-loss" role="alert">{error}</p>}
			{message&&<p className="mt-3 text-sm text-profit" role="status">{message}</p>}
			{loading?<p className="mt-4 muted">Loading links…</p>:(
				<div className="mt-4 space-y-3">
					{links.map((link,index)=>(
						<div key={link.id} className="grid gap-2 rounded-xl border border-white/10 bg-black/20 p-3 sm:grid-cols-[1fr_1fr_auto]">
							<label className="text-xs muted">Title<input className="input mt-1" value={link.title} onChange={event=>setLinks(current=>current.map((row,i)=>i===index?{...row,title:event.target.value}:row))}/></label>
							<label className="text-xs muted">URL<input className="input mt-1" value={link.url} placeholder="https://… or /path" onChange={event=>setLinks(current=>current.map((row,i)=>i===index?{...row,url:event.target.value}:row))}/></label>
							<div className="flex items-end gap-2">
								<button type="button" className="btn bg-white/5" onClick={()=>setLinks(current=>current.filter((_,i)=>i!==index))} aria-label="Remove link"><Trash2 size={14}/></button>
							</div>
							<label className="text-xs muted sm:col-span-3">Description (optional)<input className="input mt-1" value={link.description||''} onChange={event=>setLinks(current=>current.map((row,i)=>i===index?{...row,description:event.target.value}:row))}/></label>
						</div>
					))}
					<button type="button" className="btn bg-white/10" onClick={()=>setLinks(current=>[...current,blank()])}><Plus size={14}/>Add link</button>
					<button type="button" className="btn bg-white/5" onClick={()=>setLinks(current=>[...current,{id:crypto.randomUUID(),title:'Return to Aurevia',url:'/',description:'Back to the main website'}])}><ExternalLink size={14}/>Add “Return to Aurevia” home link</button>
				</div>
			)}
		</section>
	);
}
