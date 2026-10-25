'use client';

import {useCallback,useEffect,useState} from 'react';
import Link from 'next/link';
import {Activity,ArrowDownRight,ArrowRight,ArrowUpRight,BriefcaseBusiness,CheckCircle2,RefreshCw,Send,ShieldCheck,Sparkles,UsersRound,WalletCards} from 'lucide-react';

type DashboardData={
	generatedAt:string;
	metrics:{
		users:{total:number;newThisWeek:number;previousWeek:number};
		deposits:{totalUsd:string;last7DaysUsd:string;changePercent:number|null};
		withdrawals:{totalUsd:string;last7DaysUsd:string;changePercent:number|null};
		investments:{totalUsd:string;last7DaysUsd:string;changePercent:number|null};
	};
	daily:Array<{date:string;depositsUsd:number;withdrawalsUsd:number}>;
	kyc:{verified:number;pending:number;rejected:number};
	accountTypes:{DEMO:number;REAL:number};
	recentUsers:Array<{id:string;name:string|null;email:string;accountMode:'DEMO'|'REAL';kycStatus:string;status:string;createdAt:string}>;
	recentActivity:Array<{id:string;action:string;entity:string;createdAt:string;actor:{name:string|null}|null}>;
	limitations:{financialCurrency:string;financialAccountMode:string;investmentTotalMeaning:string;accountTypesMeaning:string};
};

type Health={ok:boolean;database:string};
type DashboardVisualization={id:string;type:'stat'|'timeseries'|'bar';title:string};
type DashboardConfiguration={
	status:'success'|'clarification_needed';
	interpretation:string;
	clarification_question:string|null;
	visualizations:DashboardVisualization[];
};
type AssistantResponse={configuration:DashboardConfiguration;model:string};

const money=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2});
const integer=new Intl.NumberFormat('en-US');

function relativeTime(value:string,reference:number){
	const age=reference-new Date(value).getTime();
	if(!Number.isFinite(age))return 'Time unavailable';
	const minutes=Math.max(0,Math.floor(age/60_000));
	if(minutes<1)return 'Just now';
	if(minutes<60)return `${minutes}m ago`;
	const hours=Math.floor(minutes/60);
	if(hours<24)return `${hours}h ago`;
	return `${Math.floor(hours/24)}d ago`;
}

function displayAction(value:string){
	return value.toLowerCase().replaceAll('_',' ').replace(/\b\w/g,letter=>letter.toUpperCase());
}

function MetricCard({label,value,detail,change,icon:Icon}:{label:string;value:string;detail:string;change?:number|null;icon:typeof UsersRound}){
	return <article className="admin-metric-card">
		<div className="admin-metric-top"><span>{label}</span><span className="admin-metric-icon"><Icon size={17}/></span></div>
		<strong>{value}</strong>
		<div className="admin-metric-bottom"><span>{detail}</span>{change!==undefined&&change!==null&&<span className={`admin-metric-change ${change<0?'is-down':''}`}>{change>=0?<ArrowUpRight size={13}/>:<ArrowDownRight size={13}/>} {Math.abs(change)}% vs prior 7d</span>}</div>
	</article>;
}

function DashboardAssistant({data}:{data:DashboardData}){
	const [question,setQuestion]=useState('');
	const [configuration,setConfiguration]=useState<DashboardConfiguration|null>(null);
	const [error,setError]=useState('');
	const [busy,setBusy]=useState(false);
	async function submit(event:React.FormEvent<HTMLFormElement>){
		event.preventDefault();
		setBusy(true);setError('');
		try{
			const response=await fetch('/api/admin/dashboard/assistant',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({question})});
			const result=await response.json();
			if(!response.ok)throw new Error(result.error||'Unable to configure dashboard view.');
			setConfiguration((result as AssistantResponse).configuration);
		}catch(exception){setError(exception instanceof Error?exception.message:'Unable to configure dashboard view.')}
		finally{setBusy(false)}
	}
	function visualizationValue(id:string){
		switch(id){
			case 'users_total':return integer.format(data.metrics.users.total);
			case 'users_new_7d':return integer.format(data.metrics.users.newThisWeek);
			case 'deposits_total_usd':return money.format(Number(data.metrics.deposits.totalUsd));
			case 'deposits_7d_usd':return money.format(Number(data.metrics.deposits.last7DaysUsd));
			case 'withdrawals_total_usd':return money.format(Number(data.metrics.withdrawals.totalUsd));
			case 'withdrawals_7d_usd':return money.format(Number(data.metrics.withdrawals.last7DaysUsd));
			case 'investments_total_usd':return money.format(Number(data.metrics.investments.totalUsd));
			case 'investments_activated_7d_usd':return money.format(Number(data.metrics.investments.last7DaysUsd));
			default:return null;
		}
	}
	function visualizationRows(id:string){
		if(id==='kyc_status')return [['Verified',data.kyc.verified],['Pending',data.kyc.pending],['Rejected',data.kyc.rejected]] as const;
		if(id==='account_modes')return [['DEMO',data.accountTypes.DEMO],['REAL',data.accountTypes.REAL]] as const;
		return [];
	}
	const maxDaily=Math.max(1,...data.daily.flatMap(day=>[day.depositsUsd,day.withdrawalsUsd]));

	return <section className="admin-panel admin-dashboard-assistant" aria-labelledby="admin-ai-dashboard-heading">
		<header className="admin-panel-heading"><div><p className="admin-eyebrow">CONFIGURATION ONLY · LIVE ADMIN METRICS</p><h2 id="admin-ai-dashboard-heading"><Sparkles size={17}/> Ask the dashboard</h2><p>Describe the Aurevia metrics you want to focus on.</p></div><span className="admin-ai-badge">AI ASSIST</span></header>
		<form className="admin-dashboard-assistant-form" onSubmit={submit}>
			<label className="sr-only" htmlFor="admin-dashboard-question">Ask about dashboard metrics</label>
			<input id="admin-dashboard-question" value={question} onChange={event=>setQuestion(event.target.value)} maxLength={1000} minLength={3} placeholder="e.g. Compare deposits and withdrawals over the last 7 days" required/>
			<button type="submit" disabled={busy||question.trim().length<3}><Send size={14}/>{busy?'Thinking…':'Configure view'}</button>
		</form>
		{error&&<p className="admin-dashboard-error" role="alert">{error}</p>}
		{configuration&&<div className="admin-dashboard-assistant-result" aria-live="polite">
			<p className="admin-ai-interpretation">{configuration.interpretation}</p>
			{configuration.status==='clarification_needed'?<p className="admin-ai-clarification">{configuration.clarification_question}</p>:<div className="admin-ai-visualizations">
				{configuration.visualizations.map(visualization=>{
					const value=visualizationValue(visualization.id);
					const rows=visualizationRows(visualization.id);
					return <article className={`admin-ai-visualization ${visualization.type}`} key={visualization.id}>
						<h3>{visualization.title}</h3>
						{value!==null?<strong>{value}</strong>:visualization.id==='daily_funding'?<div className="admin-ai-timeseries" role="img" aria-label="Daily REAL USD deposits and withdrawals over the last seven days">{data.daily.map(day=><div key={day.date} title={`${day.date}: deposits ${money.format(day.depositsUsd)}, withdrawals ${money.format(day.withdrawalsUsd)}`}><span><i style={{height:`${day.depositsUsd/maxDaily*100}%`}}/><i style={{height:`${day.withdrawalsUsd/maxDaily*100}%`}}/></span><small>{new Date(`${day.date}T00:00:00Z`).toLocaleDateString(undefined,{weekday:'short',timeZone:'UTC'})}</small></div>)}</div>:<div className="admin-ai-bars">{rows.map(([label,count])=><div key={label}><span>{label}</span><span className="admin-ai-bar-track"><i style={{width:`${count/Math.max(1,...rows.map(([,amount])=>amount))*100}%`}}/></span><b>{integer.format(count)}</b></div>)}</div>}
					</article>;
				})}
			</div>}
			{configuration.status==='success'&&<p className="admin-ai-source-note">Values are read from the loaded admin dashboard aggregates. AI selects presentation only; it cannot query or modify records.</p>}
		</div>}
	</section>;
}

function PlatformChart({daily}:{daily:DashboardData['daily']}){
	const max=Math.max(1,...daily.flatMap(day=>[day.depositsUsd,day.withdrawalsUsd]));
	const points=(key:'depositsUsd'|'withdrawalsUsd')=>daily.map((day,index)=>{
		const x=54+index*(592/Math.max(1,daily.length-1));
		const y=196-(day[key]/max)*160;
		return `${x},${y}`;
	}).join(' ');
	return <section className="admin-panel admin-chart-panel" aria-labelledby="admin-platform-overview">
		<header className="admin-panel-heading"><div><p className="admin-eyebrow">REAL ACCOUNT ACTIVITY</p><h2 id="admin-platform-overview">Platform overview</h2><p>Approved USD deposits and settled USD withdrawals, daily.</p></div><span className="admin-period-label">LAST 7 DAYS · REAL</span></header>
		<div className="admin-chart-legend"><span><i className="deposit-dot"/>Deposits</span><span><i className="withdrawal-dot"/>Withdrawals</span></div>
		{daily.length===0?<p className="admin-empty-state">Daily activity is currently unavailable.</p>:<>
			<svg className="admin-platform-chart" viewBox="0 0 700 250" role="img" aria-labelledby="admin-chart-title admin-chart-description">
				<title id="admin-chart-title">Daily approved deposits and settled withdrawals</title>
				<desc id="admin-chart-description">{daily.map(day=>`${day.date}: deposits ${money.format(day.depositsUsd)}, withdrawals ${money.format(day.withdrawalsUsd)}`).join('; ')}</desc>
				{[36,76,116,156,196].map(y=><line key={y} x1="54" x2="646" y1={y} y2={y} className="admin-chart-gridline"/>)}
				<polyline points={points('depositsUsd')} className="admin-chart-deposits"/>
				<polyline points={points('withdrawalsUsd')} className="admin-chart-withdrawals"/>
				{daily.map((day,index)=>{
					const x=54+index*(592/Math.max(1,daily.length-1));
					const depositY=196-(day.depositsUsd/max)*160;
					const withdrawalY=196-(day.withdrawalsUsd/max)*160;
					return <g key={day.date}><circle cx={x} cy={depositY} r="3" className="admin-chart-deposit-point"><title>{day.date}: deposits {money.format(day.depositsUsd)}</title></circle><circle cx={x} cy={withdrawalY} r="3" className="admin-chart-withdrawal-point"><title>{day.date}: withdrawals {money.format(day.withdrawalsUsd)}</title></circle><text x={x} y="226" textAnchor="middle" className="admin-chart-label">{new Date(`${day.date}T00:00:00Z`).toLocaleDateString(undefined,{month:'short',day:'numeric',timeZone:'UTC'})}</text></g>;
				})}
			</svg>
			<div className="admin-chart-totals"><span>Deposits this week <b>{money.format(daily.reduce((sum,day)=>sum+day.depositsUsd,0))}</b></span><span>Withdrawals this week <b>{money.format(daily.reduce((sum,day)=>sum+day.withdrawalsUsd,0))}</b></span></div>
		</>}
	</section>;
}

function AccountStatus({kyc}:{kyc:DashboardData['kyc']}){
	const total=kyc.verified+kyc.pending+kyc.rejected;
	const verified=(kyc.verified/Math.max(1,total))*100;
	const pending=(kyc.pending/Math.max(1,total))*100;
	const rejected=(kyc.rejected/Math.max(1,total))*100;
	return <section className="admin-panel" aria-labelledby="admin-kyc-heading">
		<header className="admin-panel-heading"><div><p className="admin-eyebrow">IDENTITY REVIEW</p><h2 id="admin-kyc-heading">Account status</h2></div><Link href="/admin/kyc" className="admin-panel-link">Review <ArrowRight size={14}/></Link></header>
		<div className="admin-status-overview">
			<div className="admin-status-donut" role="img" aria-label={`${kyc.verified} verified, ${kyc.pending} pending review, ${kyc.rejected} rejected`} style={{background:`conic-gradient(#d4a72c 0 ${verified}%,#7b8c7f ${verified}% ${verified+pending}%,#c87868 ${verified+pending}% ${verified+pending+rejected}%,rgba(255,255,255,.08) ${verified+pending+rejected}% 100%)`}}><div><b>{integer.format(total)}</b><span>profiles</span></div></div>
			<div className="admin-status-legend">
				<StatusRow label="Verified" count={kyc.verified} total={total} color="gold"/>
				<StatusRow label="Pending" count={kyc.pending} total={total} color="muted"/>
				<StatusRow label="Rejected" count={kyc.rejected} total={total} color="loss"/>
			</div>
		</div>
	</section>;
}

function StatusRow({label,count,total,color}:{label:string;count:number;total:number;color:string}){
	return <div className="admin-status-row"><span><i className={`admin-status-dot ${color}`}/>{label}</span><b>{integer.format(count)}</b><small>{total?Math.round(count/total*100):0}%</small></div>;
}

export default function AdminDashboard(){
	const [data,setData]=useState<DashboardData|null>(null);
	const [health,setHealth]=useState<Health|null>(null);
	const [loading,setLoading]=useState(true);
	const [error,setError]=useState('');

	const load=useCallback(async()=>{
		setLoading(true);
		setError('');
		try{
			const [dashboardResponse,healthResponse]=await Promise.all([
				fetch('/api/admin/dashboard',{cache:'no-store'}),
				fetch('/api/health',{cache:'no-store'}),
			]);
			const result=await dashboardResponse.json();
			if(!dashboardResponse.ok)throw new Error(result.error||'Unable to load dashboard data.');
			setData(result as DashboardData);
			if(healthResponse.ok){
				try{setHealth(await healthResponse.json() as Health)}
				catch{setHealth({ok:false,database:'unavailable'})}
			}else setHealth({ok:false,database:'unavailable'});
		}catch(exception){setError(exception instanceof Error?exception.message:'Unable to load dashboard data.');}
		finally{setLoading(false);}
	},[]);

	useEffect(()=>{void load()},[load]);

	return <main className="account-page admin-dashboard-page">
		<header className="admin-dashboard-heading">
			<div><p className="admin-eyebrow">AUREVIA INVEST · CONTROL ROOM</p><h1>Good to see you.</h1><p>Live platform performance and operational activity.</p></div>
			<button type="button" className="admin-refresh-button" onClick={()=>void load()} disabled={loading}><RefreshCw size={15} className={loading?'admin-refresh-spinning':''}/>Refresh data</button>
		</header>
		{data&&<DashboardAssistant data={data}/>}
		{error&&<p className="admin-dashboard-error" role="alert">{error}<button type="button" onClick={()=>void load()}>Retry</button></p>}
		{loading&&!data?<div className="admin-dashboard-loading" role="status"><span className="admin-loading-indicator"/>Loading live platform data…</div>:data&&<>
			<section className="admin-kpi-grid" aria-label="Platform key metrics">
				<MetricCard label="Total users" value={integer.format(data.metrics.users.total)} detail={`+${integer.format(data.metrics.users.newThisWeek)} new this week`} icon={UsersRound}/>
				<MetricCard label="Approved deposits" value={money.format(Number(data.metrics.deposits.totalUsd))} detail={`7d ${money.format(Number(data.metrics.deposits.last7DaysUsd))}`} change={data.metrics.deposits.changePercent} icon={ArrowDownRight}/>
				<MetricCard label="Settled withdrawals" value={money.format(Number(data.metrics.withdrawals.totalUsd))} detail={`7d ${money.format(Number(data.metrics.withdrawals.last7DaysUsd))}`} change={data.metrics.withdrawals.changePercent} icon={WalletCards}/>
				<MetricCard label="Total investments" value={money.format(Number(data.metrics.investments.totalUsd))} detail={`7d activated ${money.format(Number(data.metrics.investments.last7DaysUsd))}`} change={data.metrics.investments.changePercent} icon={BriefcaseBusiness}/>
			</section>
			<p className="admin-metric-disclaimer">Financial values are USD and REAL account mode only; these are internal Aurevia ledger records, not external payment totals. Investment values include active, paused, completed, and settled REAL requests.</p>
			<div className="admin-dashboard-main-grid">
				<PlatformChart daily={data.daily}/>
				<div className="admin-dashboard-side-stack">
					<AccountStatus kyc={data.kyc}/>
					<section className="admin-panel" aria-labelledby="admin-account-types-heading">
						<header className="admin-panel-heading"><div><p className="admin-eyebrow">CURRENT ACCOUNT MODES</p><h2 id="admin-account-types-heading">Account types</h2></div><UsersRound size={18} className="admin-panel-icon"/></header>
						<div className="admin-account-type-list"><div><span className="admin-mode-icon demo"><Activity size={16}/></span><span><b>DEMO</b><small>Current account mode</small></span><strong>{integer.format(data.accountTypes.DEMO)}</strong></div><div><span className="admin-mode-icon real"><ShieldCheck size={16}/></span><span><b>REAL</b><small>Internal ledger mode</small></span><strong>{integer.format(data.accountTypes.REAL)}</strong></div></div>
						<p className="admin-panel-note">{data.limitations.accountTypesMeaning}</p>
					</section>
				</div>
			</div>
			<section className="admin-quick-actions" aria-labelledby="admin-quick-actions-heading">
				<div><p className="admin-eyebrow">WORKSPACE SHORTCUTS</p><h2 id="admin-quick-actions-heading">Quick actions</h2></div>
				<div className="admin-quick-action-list">
					<QuickAction href="/admin/kyc" label="Review KYC" icon={CheckCircle2}/>
					<QuickAction href="/admin/payments" label="Process deposit" icon={WalletCards}/>
					<QuickAction href="/admin/payments?type=WITHDRAWAL" label="Process withdrawal" icon={ArrowUpRight}/>
					<QuickAction href="/admin/investments" label="Investments" icon={BriefcaseBusiness}/>
					<QuickAction href="/admin/cards" label="Cards" icon={WalletCards}/>
				</div>
			</section>
			<div className="admin-dashboard-bottom-grid">
				<section className="admin-panel admin-recent-users" aria-labelledby="admin-recent-users-heading">
					<header className="admin-panel-heading"><div><p className="admin-eyebrow">CUSTOMER ACCOUNTS</p><h2 id="admin-recent-users-heading">Recent users</h2></div><Link href="/admin/users" className="admin-panel-link">All users <ArrowRight size={14}/></Link></header>
					<div className="admin-table-wrap"><table className="admin-dashboard-table"><thead><tr><th>User</th><th>Mode</th><th>KYC</th><th>Joined</th><th><span className="sr-only">View user</span></th></tr></thead><tbody>{data.recentUsers.map(user=><tr key={user.id}><td><Link href={`/admin/users?search=${encodeURIComponent(user.email)}`} className="admin-user-link"><span className="admin-user-avatar">{(user.name||user.email).slice(0,1).toUpperCase()}</span><span><b>{user.name||'Unnamed user'}</b><small>{user.email}</small></span></Link></td><td><span className={`admin-mode-tag ${user.accountMode.toLowerCase()}`}>{user.accountMode}</span></td><td><span className={`admin-kyc-tag ${user.kycStatus.toLowerCase()}`}>{user.kycStatus.replaceAll('_',' ')}</span></td><td>{new Date(user.createdAt).toLocaleDateString()}</td><td><Link href={`/admin/users?search=${encodeURIComponent(user.email)}`} className="admin-row-action">View <ArrowRight size={13}/></Link></td></tr>)}</tbody></table></div>
					{data.recentUsers.length===0&&<p className="admin-empty-state">No active customer accounts to show.</p>}
				</section>
				<section className="admin-panel admin-activity-panel" aria-labelledby="admin-activity-heading">
					<header className="admin-panel-heading"><div><p className="admin-eyebrow">ADMINISTRATIVE RECORDS</p><h2 id="admin-activity-heading">Live activity</h2></div><Link href="/admin/audit-logs" className="admin-panel-link">Audit log <ArrowRight size={14}/></Link></header>
					{data.recentActivity.length?<ol className="admin-activity-list">{data.recentActivity.map(event=><li key={event.id}><span className="admin-activity-marker"><Activity size={13}/></span><span className="admin-activity-copy"><b>{displayAction(event.action)}</b><small>{event.entity.replaceAll('_',' ')}{event.actor?.name?` · ${event.actor.name}`:''}</small></span><time dateTime={event.createdAt} title={new Date(event.createdAt).toLocaleString()}>{relativeTime(event.createdAt,new Date(data.generatedAt).getTime())}</time></li>)}</ol>:<p className="admin-empty-state">No audit activity recorded yet.</p>}
					<p className="admin-panel-note">Recent audit event metadata is intentionally omitted.</p>
				</section>
			</div>
		</>}
		<footer className="admin-dashboard-footer"><span><i className={health?.ok?'is-online':'is-offline'}/>{health===null?'Checking system health…':health.ok&&health.database==='ok'?'System online · Database responding':'System health unavailable'}</span><span><ShieldCheck size={14}/>Authenticated admin workspace</span><span>{data?`Updated ${new Date(data.generatedAt).toLocaleTimeString()}`:'Live data'}</span></footer>
	</main>;
}

function QuickAction({href,label,icon:Icon}:{href:string;label:string;icon:typeof CheckCircle2}){
	return <Link href={href} className="admin-quick-action"><Icon size={16}/><span>{label}</span><ArrowRight size={13}/></Link>;
}
