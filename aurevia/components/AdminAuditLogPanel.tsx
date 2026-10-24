'use client';

import {useEffect,useState} from 'react';
import {RefreshCw,Search} from 'lucide-react';

type AuditEvent={id:string;actorId?:string|null;action:string;entity:string;entityId?:string|null;metadata?:Record<string,unknown>|null;summary?:string|null;createdAt:string};
const pageSize=25;

export default function AdminAuditLogPanel(){
	const [events,setEvents]=useState<AuditEvent[]>([]);
	const [search,setSearch]=useState('');
	const [page,setPage]=useState(1);
	const [loading,setLoading]=useState(true);
	const [error,setError]=useState('');
	const [refresh,setRefresh]=useState(0);

	useEffect(()=>{
		const controller=new AbortController();
		fetch('/api/admin/audit',{cache:'no-store',signal:controller.signal}).then(async response=>{
			const result=await response.json();if(!response.ok)throw new Error(result.error||'Unable to load audit records.');
			if(!controller.signal.aborted)setEvents(result);
		}).catch(exception=>{if(!controller.signal.aborted)setError(exception instanceof Error?exception.message:'Unable to load audit records.')}).finally(()=>{if(!controller.signal.aborted)setLoading(false)});
		return()=>controller.abort();
	},[refresh]);

	const filtered=events.filter(event=>`${event.action} ${event.entity} ${event.entityId||''} ${event.summary||''} ${event.actorId||''}`.toLowerCase().includes(search.trim().toLowerCase()));
	const pageCount=Math.ceil(filtered.length/pageSize);
	const pageItems=filtered.slice((page-1)*pageSize,page*pageSize);

	return <div className="account-page">
		<header className="account-heading"><div><span className="account-kicker">SERVICE &amp; SYSTEM</span><h1>Administrative audit log</h1><p>Persisted administrator actions and internal notification events.</p></div><button type="button" className="icon-action" aria-label="Refresh audit log" onClick={()=>setRefresh(value=>value+1)}><RefreshCw size={15}/></button></header>
		<label className="account-label mb-4 block">Search history<div className="relative mt-1"><Search size={15} className="absolute left-3 top-3.5 muted"/><input className="input pl-9" value={search} onChange={event=>{setPage(1);setSearch(event.target.value)}} placeholder="Action, entity, account ID" maxLength={160}/></div></label>
		{error&&<div className="account-callout mb-3" role="alert">{error}</div>}
		<div className="overflow-x-auto rounded-md border border-white/10"><table className="account-table min-w-[760px]"><thead><tr><th>Time</th><th>Action</th><th>Entity</th><th>Actor</th><th>Record</th></tr></thead><tbody>{pageItems.map(event=><tr key={event.id}><td>{new Date(event.createdAt).toLocaleString()}</td><td><span className="gold">{event.action}</span>{event.summary&&<small className="block muted">{event.summary}</small>}</td><td>{event.entity}</td><td className="font-mono text-xs">{event.actorId||'System'}</td><td className="font-mono text-xs">{event.entityId||event.id}</td></tr>)}{!loading&&!pageItems.length&&<tr><td colSpan={5} className="account-empty">No matching events.</td></tr>}</tbody></table></div>
		<div className="mt-3 flex items-center justify-between gap-3"><span className="text-xs muted">{loading?'Loading history…':`${filtered.length} events · page ${pageCount?page:0} of ${pageCount}`}</span><div className="flex gap-2"><button className="btn min-h-10 bg-white/5" disabled={page<=1} onClick={()=>setPage(value=>value-1)}>Previous</button><button className="btn min-h-10 bg-white/5" disabled={page>=pageCount} onClick={()=>setPage(value=>value+1)}>Next</button></div></div>
	</div>;
}