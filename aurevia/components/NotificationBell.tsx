'use client';

import {useCallback,useEffect,useRef,useState} from 'react';
import {useSession} from 'next-auth/react';
import {useRouter} from 'next/navigation';
import {Activity,Bell,CheckCheck,ChevronRight,CircleDollarSign,Info,LifeBuoy,RefreshCw,ShieldCheck,UserRound,WalletCards} from 'lucide-react';
import {useLocale} from '@/lib/i18n-context';

type NotificationItem={id:string;type:string;title:string;message:string;isRead:boolean;createdAt:string;actionUrl:string|null};
type NotificationResponse={notifications:NotificationItem[];unreadCount:number};

const iconByType:Record<string,typeof Bell>={ACCOUNT:UserRound,SECURITY:ShieldCheck,KYC:ShieldCheck,DEPOSIT:CircleDollarSign,WITHDRAWAL:WalletCards,TRADE:Activity,MARKET:Activity,SUPPORT:LifeBuoy,SYSTEM:Info};

export default function NotificationBell(){
	const {status}=useSession();
	const router=useRouter();
	const {translate}=useLocale();
	const panelRef=useRef<HTMLDivElement>(null);
	const [open,setOpen]=useState(false);
	const [notifications,setNotifications]=useState<NotificationItem[]>([]);
	const [unreadCount,setUnreadCount]=useState(0);
	const [loading,setLoading]=useState(true);
	const [error,setError]=useState('');
	const [busy,setBusy]=useState(false);

	const load=useCallback(async(showLoading=false)=>{
		if(status!=='authenticated'){setLoading(false);return;}
		if(showLoading)setLoading(true);
		try{
			const response=await fetch('/api/notifications?limit=8',{cache:'no-store'});
			if(response.status===401){setNotifications([]);setUnreadCount(0);setError('');setOpen(false);return;}
			if(!response.ok)throw new Error('Unable to load notifications.');
			const result:NotificationResponse=await response.json();
			setNotifications(result.notifications);setUnreadCount(result.unreadCount);setError('');
		}catch(exception){setError(exception instanceof Error?exception.message:'Unable to load notifications.');}
		finally{if(showLoading)setLoading(false);}
	},[status]);

	useEffect(()=>{
		if(status!=='authenticated')return;
		let active=true;
		const refresh=()=>{if(active)void load()};
		void load(true);
		const interval=window.setInterval(refresh,45000);
		window.addEventListener('aurevia:notifications',refresh);
		return()=>{active=false;window.clearInterval(interval);window.removeEventListener('aurevia:notifications',refresh)};
	},[load,status]);

	useEffect(()=>{
		if(!open)return;
		const onPointerDown=(event:PointerEvent)=>{if(!panelRef.current?.contains(event.target as Node))setOpen(false)};
		const onKeyDown=(event:KeyboardEvent)=>{if(event.key==='Escape')setOpen(false)};
		document.addEventListener('pointerdown',onPointerDown);document.addEventListener('keydown',onKeyDown);
		return()=>{document.removeEventListener('pointerdown',onPointerDown);document.removeEventListener('keydown',onKeyDown)};
	},[open]);

	async function markRead(item:NotificationItem){
		if(busy)return;
		if(!item.isRead){
			setBusy(true);setError('');
			try{const response=await fetch('/api/notifications',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({action:'read',id:item.id})});if(!response.ok)throw new Error('Unable to mark this notification as read.');const result=await response.json();setNotifications(current=>current.map(notification=>notification.id===item.id?{...notification,isRead:true}:notification));setUnreadCount(result.unreadCount);}
			catch(exception){setError(exception instanceof Error?exception.message:'Unable to update notifications.');return;}
			finally{setBusy(false);}
		}
		if(item.actionUrl){
			setOpen(false);
			router.push(item.actionUrl);
		}
	}

	async function markAllRead(){
		if(busy||!unreadCount)return;
		setBusy(true);setError('');
		try{const response=await fetch('/api/notifications',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({action:'read-all'})});if(!response.ok)throw new Error('Unable to update notifications.');const result=await response.json();setNotifications(current=>current.map(item=>({...item,isRead:true})));setUnreadCount(result.unreadCount);}
		catch(exception){setError(exception instanceof Error?exception.message:'Unable to update notifications.');}
		finally{setBusy(false);}
	}

	if(status!=='authenticated')return null;
	return <div className="notification-bell" ref={panelRef}>
		<button type="button" className="notification-bell-button" aria-label={translate('notifications')+(unreadCount?` · ${translate('unreadCount',{count:unreadCount})}`:'')} aria-expanded={open} aria-haspopup="dialog" onClick={()=>{setOpen(value=>!value);void load(true)}}>
			<Bell size={17} aria-hidden="true"/>{unreadCount>0&&<span className="notification-count">{unreadCount>99?'99+':unreadCount}</span>}
		</button>
		{open&&<section className="notification-popover" role="dialog" aria-label={translate('notifications')}>
			<header><div><b>{translate('notifications')}</b><small>{unreadCount?translate('unreadCount',{count:unreadCount}):translate('recentAccountActivity')}</small></div><div className="notification-popover-actions"><button type="button" aria-label={translate('markAllNotificationsRead')} title={translate('markAllRead')} disabled={busy||!unreadCount} onClick={()=>void markAllRead()}><CheckCheck size={15}/></button><button type="button" aria-label={translate('closeNotifications')} className="notification-close" onClick={()=>setOpen(false)}>×</button></div></header>
			{error&&<p className="notification-error" role="alert">{error}<button type="button" onClick={()=>void load(true)} aria-label={translate('retry')}><RefreshCw size={13}/></button></p>}
			<div className="notification-popover-list">{loading?<p className="notification-state" role="status">{translate('notificationLoading')}</p>:notifications.length?notifications.map(item=>{const Icon=iconByType[item.type]||Info;return <button className={`notification-row ${item.isRead?'is-read':'is-unread'}`} type="button" key={item.id} onClick={()=>void markRead(item)} disabled={busy}><span className={`notification-icon notification-type-${item.type.toLowerCase()}`}><Icon size={15}/></span><span className="notification-copy"><b>{item.title}</b><span>{item.message}</span><time dateTime={item.createdAt}>{relativeTime(item.createdAt)}</time></span>{item.actionUrl&&<ChevronRight size={14} className="notification-chevron"/>}</button>}):<p className="notification-empty">{translate('noNotificationsAvailable')}</p>}</div>
			<footer><button type="button" className="notification-history-link" onClick={()=>{setOpen(false);router.push('/notifications')}}>{translate('viewNotificationHistory')} <ChevronRight size={14}/></button></footer>
		</section>}
	</div>;
}

export function relativeTime(value:string){
	const timestamp=new Date(value).getTime();
	if(!Number.isFinite(timestamp))return 'Recently';
	const seconds=Math.round((timestamp-Date.now())/1000);
	const formatter=new Intl.RelativeTimeFormat(undefined,{numeric:'auto'});
	if(Math.abs(seconds)<60)return formatter.format(seconds,'second');
	if(Math.abs(seconds)<3600)return formatter.format(Math.round(seconds/60),'minute');
	if(Math.abs(seconds)<86400)return formatter.format(Math.round(seconds/3600),'hour');
	return formatter.format(Math.round(seconds/86400),'day');
}