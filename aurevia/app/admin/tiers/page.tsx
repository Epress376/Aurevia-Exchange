'use client';

import {useCallback,useEffect,useState} from 'react';
import Link from 'next/link';
import {ArrowLeft,RefreshCw,ShieldCheck} from 'lucide-react';
import AdminNav from '@/components/AdminNav';

type TierRequest={
	id:string;currentTier:number;requestedTier:number;status:'PENDING_REVIEW'|'NEEDS_INFORMATION'|'APPROVED'|'REJECTED';
	userMessage:string|null;adminReason:string|null;createdAt:string;reviewedAt:string|null;
	user:{id:string;name:string|null;email:string;accountMode:'DEMO'|'REAL';kycStatus:string;approvedTier:number;kyc:{submittedAt:string|null}|null;kycDocuments:Array<{id:string;status:string}>};
	reviewedBy:{name:string|null;email:string}|null;
};
type Outcome='NEEDS_INFORMATION'|'APPROVED'|'REJECTED';

export default function AdminTierReviews(){
	const [items,setItems]=useState<TierRequest[]>([]);
	const [selectedId,setSelectedId]=useState('');
	const [reason,setReason]=useState('');
	const [filter,setFilter]=useState('PENDING_REVIEW');
	const [notice,setNotice]=useState('');
	const [error,setError]=useState('');
	const [busy,setBusy]=useState(false);
	const [loading,setLoading]=useState(true);
	const selected=items.find(item=>item.id===selectedId);
	const load=useCallback(async()=>{
		setLoading(true);
		try{
			const response=await fetch('/api/admin/tier-requests',{cache:'no-store'});
			const data=await response.json();
			if(!response.ok)throw new Error(data.error||'Administrator authorization required.');
			setItems(data);setError('');setSelectedId(current=>data.some((item:TierRequest)=>item.id===current)?current:data.find((item:TierRequest)=>item.status===filter)?.id||data[0]?.id||'');
		}catch(exception){setError(exception instanceof Error?exception.message:'Unable to load tier requests.')}
		finally{setLoading(false)}
	},[filter]);
	useEffect(()=>{void load()},[load]);
	const visible=items.filter(item=>filter==='ALL'||item.status===filter);
	async function review(status:Outcome){
		if(!selected||busy||reason.trim().length<3)return;
		setBusy(true);setNotice('');setError('');
		try{
			const response=await fetch('/api/admin/tier-requests',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({id:selected.id,status,reason:reason.trim()})});
			const data=await response.json();
			if(!response.ok)throw new Error(data.error||'Unable to save tier review.');
			setNotice(status==='APPROVED'?'Tier request approved; the tier is updated.':status==='REJECTED'?'Tier request rejected.':'More information requested.');
			setReason('');await load();
		}catch(exception){setError(exception instanceof Error?exception.message:'Unable to save tier review.')}
		finally{setBusy(false)}
	}
	return <><AdminNav/><main className="account-page">
		<header className="account-heading"><div><span className="account-kicker">ADMINISTRATION · ACCOUNT ACCESS</span><h1>Tier review queue</h1><p>Review each step-up request, record an auditable reason, and notify the user.</p></div><div className="flex gap-2"><Link className="button-secondary" href="/admin"><ArrowLeft size={14}/> Admin home</Link><button className="icon-action" type="button" aria-label="Refresh tier requests" onClick={()=>void load()}><RefreshCw size={15}/></button></div></header>
		{notice&&<p className="mb-3 text-sm text-profit" role="status">{notice}</p>}{error&&<p className="mb-3 text-sm text-loss" role="alert">{error}</p>}
		<div className="admin-support-layout">
			<aside className="account-panel card p-4"><div className="account-panel-title"><div><h2>Requests</h2><p className="account-panel-subtitle">{visible.length} shown · {items.length} total</p></div><ShieldCheck size={18} className="gold"/></div><label className="account-label">Filter<select className="input" value={filter} onChange={event=>setFilter(event.target.value)}><option value="PENDING_REVIEW">Pending review</option><option value="NEEDS_INFORMATION">Needs information</option><option value="APPROVED">Approved</option><option value="REJECTED">Rejected</option><option value="ALL">All requests</option></select></label>{loading?<p className="account-empty">Loading tier requests…</p>:visible.length?<div className="support-ticket-list">{visible.map(item=><button key={item.id} type="button" className={`support-inbox-item ${selectedId===item.id?'is-selected':''}`} onClick={()=>setSelectedId(item.id)}><b>Tier {item.currentTier} → Tier {item.requestedTier}</b><span>{item.user.name||item.user.email}</span><small>{item.status.replaceAll('_',' ')} · {item.user.accountMode}</small><small>{new Date(item.createdAt).toLocaleString()}</small></button>)}</div>:<p className="account-empty">No tier requests in this state.</p>}</aside>
			<section className="account-panel card p-5">{!selected?<div className="account-empty">Choose a request to review.</div>:<><div className="account-panel-title"><div><span className="status-pill mode-demo">{selected.status.replaceAll('_',' ')}</span><h2 className="mt-3">{selected.user.name||'Account holder'}</h2><p className="account-panel-subtitle">{selected.user.email} · Tier {selected.currentTier} to Tier {selected.requestedTier}</p></div><span className="muted text-xs">{new Date(selected.createdAt).toLocaleString()}</span></div><dl className="support-context"><div><dt>Account</dt><dd>{selected.user.accountMode} · current approved tier {selected.user.approvedTier}</dd></div><div><dt>Verification status</dt><dd>{selected.user.kycStatus} · submitted {selected.user.kyc?.submittedAt?'yes':'no'} · identity documents {selected.user.kycDocuments.length} ({selected.user.kycDocuments.map(document=>document.status).join(', ')||'none'})</dd></div><div><dt>User note</dt><dd>{selected.userMessage||'No note provided.'}</dd></div>{selected.reviewedBy&&<div><dt>Previous review</dt><dd>{selected.reviewedBy.name||selected.reviewedBy.email} · {selected.adminReason||'No reason recorded'}</dd></div>}</dl>{!['APPROVED','REJECTED'].includes(selected.status)&&<div className="support-admin-reply"><label className="account-label">Required review reason<textarea className="input min-h-24" minLength={3} maxLength={1000} value={reason} onChange={event=>setReason(event.target.value)} placeholder="Explain the decision or the information needed."/></label><div className="flex flex-wrap gap-2"><button type="button" className="btn bg-gold text-black" disabled={busy||reason.trim().length<3} onClick={()=>void review('APPROVED')}>Approve Tier {selected.requestedTier}</button><button type="button" className="btn bg-white/5" disabled={busy||reason.trim().length<3} onClick={()=>void review('NEEDS_INFORMATION')}>Request information</button><button type="button" className="btn bg-white/5" disabled={busy||reason.trim().length<3} onClick={()=>void review('REJECTED')}>Reject request</button></div></div>}<p className="mt-4 text-xs leading-5 muted">Tier approval does not enable real trading, approve KYC, or set financial limits. Documents remain in the existing private KYC review workflow.</p></>}</section>
		</div>
	</main></>;
}
