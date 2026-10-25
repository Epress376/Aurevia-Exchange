'use client';
import Link from 'next/link';
import Image from 'next/image';
import {useSession,signOut} from 'next-auth/react';
import {usePathname,useRouter} from 'next/navigation';
import {Activity,ArrowRight,BriefcaseBusiness,CreditCard,FileText,History,LayoutDashboard,LineChart,LogOut,Mail,Menu,PhoneCall,Radio,Search,Settings,ShieldCheck,Wallet,X} from 'lucide-react';
import {useEffect,useRef,useState} from 'react';
import NotificationBell from '@/components/NotificationBell';
import LanguageSelector from '@/components/LanguageSelector';
import {useLocale} from '@/lib/i18n-context';
import {MARKET_ASSETS} from '@/lib/live-market';

export default function Nav(){
 const {data,status,update}=useSession(); const pathname=usePathname(); const router=useRouter(); const {translate}=useLocale(); const [open,setOpen]=useState(false); const [modeError,setModeError]=useState(''); const [modeBusy,setModeBusy]=useState(false); const [loggingOut,setLoggingOut]=useState(false); const [taxServicesAvailable,setTaxServicesAvailable]=useState(false); const [marketSearch,setMarketSearch]=useState(''); const [marketSearchOpen,setMarketSearchOpen]=useState(false); const [tierLabel,setTierLabel]=useState(''); const userNavRef=useRef<HTMLElement>(null); const userMenuButtonRef=useRef<HTMLButtonElement>(null);
 const close=()=>setOpen(false);
 const active=(href:string)=>pathname===href||pathname.startsWith(`${href}/`);
 const userMode=status==='authenticated'&&data?.user?.role==='USER';
 const userDestinations=[
  {href:'/dashboard',label:'Dashboard',group:'Overview'},
  {href:'/markets',label:'Markets',group:'Investing'},
  {href:'/trade',label:'Trade',group:'Investing'},
  {href:'/portfolio',label:'Portfolio',group:'Investing'},
  {href:'/investments',label:'Investments',group:'Investing'},
  {href:'/orders',label:'Orders & activity',group:'Investing'},
  {href:'/wallet',label:'Wallet',group:'Account'},
  {href:'/notifications',label:'Notifications',group:'Account'},
  {href:'/kyc',label:'Identity verification',group:'Account'},
  {href:'/cards',label:'Cards',group:'Account'},
  ...(taxServicesAvailable?[{href:'/tax-services',label:'Tax services',group:'Account'}]:[]),
  {href:'/settings',label:'Profile & security',group:'Profile & support'},
  {href:'/support',label:'Help & support',group:'Profile & support'},
 ];
 const matchingPages=marketSearch.trim()?userDestinations.filter(item=>`${item.label} ${item.group}`.toLowerCase().includes(marketSearch.trim().toLowerCase())).slice(0,5):[];
 const matchingMarkets=marketSearch.trim()?MARKET_ASSETS.filter(asset=>`${asset.id} ${asset.name} ${asset.ticker}`.toLowerCase().includes(marketSearch.trim().toLowerCase())).slice(0,6):[];
 async function changeMode(accountMode:'DEMO'|'REAL'){
  if(modeBusy)return;
  setModeBusy(true);setModeError('');
  try{
   const response=await fetch('/api/account/mode',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({accountMode})});
   if(!response.ok){setModeError('Mode update failed');return;}
   await update();router.refresh();close();
  }catch{setModeError('Mode update failed');}
  finally{setModeBusy(false)}
 }
 async function logout(){
  close();setLoggingOut(true);
  try{await signOut({callbackUrl:'/login'})}
  catch{setLoggingOut(false);setModeError('Unable to sign out. Please try again.')}
 }
 useEffect(()=>{setOpen(false)},[pathname]);
 useEffect(()=>{
  if(status!=='authenticated'||!data?.user){
   setTaxServicesAvailable(false);
   return;
  }
  let active=true;
  setTaxServicesAvailable(false);
  const checkAccess=async()=>{
   if(document.visibilityState!=='visible')return;
   try{
    const response=await fetch('/api/tax-services/access',{cache:'no-store'});
    if(!response.ok){
     if(response.status!==401&&response.status!==403)console.error('Unable to check tax-service navigation access.',response.status);
     if(active)setTaxServicesAvailable(false);
     return;
    }
    const result=await response.json();
    if(active)setTaxServicesAvailable(result.hasAccess===true);
   }catch(exception){
    console.error('Unable to check tax-service navigation access.',exception instanceof Error?exception.name:'UnknownError');
   }
  };
  void checkAccess();
  const interval=window.setInterval(()=>void checkAccess(),30_000);
  window.addEventListener('focus',checkAccess);
  return ()=>{
   active=false;
   window.clearInterval(interval);
   window.removeEventListener('focus',checkAccess);
  };
 },[status,data?.user]);
 useEffect(()=>{
  if(!userMode){setTierLabel('');return}
  let active=true;
  void fetch('/api/profile',{cache:'no-store'}).then(async response=>{
   const result=await response.json();
   if(!response.ok)throw new Error(result.error||'Unable to load account tier.');
   if(active&&typeof result.label==='string')setTierLabel(result.label);
  }).catch(exception=>{if(active)console.error('Unable to load account tier.',exception instanceof Error?exception.name:'UnknownError')});
  return()=>{active=false};
 },[userMode,data?.user?.accountMode]);
 useEffect(()=>{
  if(!open)return;
  const nav=userNavRef.current;
  const focusable=()=>nav?.querySelectorAll<HTMLElement>('a[href],button:not(:disabled),input:not(:disabled)');
  const previous=document.activeElement instanceof HTMLElement?document.activeElement:null;
  focusable()?.[0]?.focus();
  const onKeyDown=(event:KeyboardEvent)=>{
   if(event.key==='Escape'){setOpen(false);userMenuButtonRef.current?.focus();return}
   if(event.key!=='Tab')return;
   const items=focusable();
   if(!items?.length)return;
   const first=items[0],last=items[items.length-1];
   if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
   else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
  };
  document.addEventListener('keydown',onKeyDown);
  return()=>{document.removeEventListener('keydown',onKeyDown);previous?.focus()};
 },[open]);
 function submitMarketSearch(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(matchingPages[0]){openPage(matchingPages[0].href);return}
  const match=matchingMarkets[0];
  if(match)openMarket(match.id);
  else if(marketSearch.trim())setMarketSearchOpen(true);
 }
 function openPage(href:string){
  router.push(href);
  setMarketSearch('');
  setMarketSearchOpen(false);
  close();
 }
 function openMarket(symbol:string){
  openPage(`/markets?symbol=${encodeURIComponent(symbol)}`);
 }
 if(userMode&&data?.user)return <header className="site-nav site-nav-authenticated site-nav-user-shell">
  {open&&<button type="button" className="user-sidebar-backdrop" aria-label="Close account navigation" onClick={close}/>}
  <div className="nav-inner">
   <Link href="/dashboard" className="brand" onClick={close}><Image src="/aurevia-logo.png" alt="Aurevia Invest" width={36} height={36}/><span>AUREVIA <b>INVEST</b></span></Link>
   <form className="user-market-search" role="search" onSubmit={submitMarketSearch}>
    <Search size={16} aria-hidden="true"/>
    <input aria-label="Search markets and account pages" autoComplete="off" value={marketSearch} onFocus={()=>setMarketSearchOpen(true)} onBlur={()=>setMarketSearchOpen(false)} onChange={event=>setMarketSearch(event.target.value)} placeholder="Search markets or pages"/>
    {marketSearch&&<button type="button" className="user-search-clear" onClick={()=>setMarketSearch('')} aria-label="Clear market search"><X size={14}/></button>}
    {marketSearchOpen&&marketSearch&&<div className="user-market-results" role="region" aria-label="Navigation search results">
     {matchingPages.length>0&&<section aria-label="Account pages"><h2>Account pages</h2>{matchingPages.map(item=><button type="button" key={item.href} onMouseDown={event=>event.preventDefault()} onClick={()=>openPage(item.href)}><span><b>{item.label}</b><small>{item.group}</small></span><ArrowRight size={14}/></button>)}</section>}
     {matchingMarkets.length>0&&<section aria-label="Markets"><h2>Markets</h2>{matchingMarkets.map(asset=><button type="button" key={asset.id} onMouseDown={event=>event.preventDefault()} onClick={()=>openMarket(asset.id)}><span><b>{asset.id}</b><small>{asset.name}</small></span><ArrowRight size={14}/></button>)}</section>}
     {!matchingPages.length&&!matchingMarkets.length&&<p>No pages or supported markets match that search.</p>}
    </div>}
   </form>
   <div className="user-mode-control" role="group" aria-label={translate('accountMode')}>
    <button type="button" aria-pressed={data.user.accountMode==='DEMO'} disabled={modeBusy||loggingOut||data.user.accountMode==='DEMO'} onClick={()=>void changeMode('DEMO')}>Demo</button>
    <button type="button" aria-pressed={data.user.accountMode==='REAL'} disabled={modeBusy||loggingOut||data.user.accountMode==='REAL'} onClick={()=>void changeMode('REAL')}>Real</button>
   </div>
   <div className="user-topbar-actions"><NotificationBell/><LanguageSelector/><button ref={userMenuButtonRef} className="menu-button" type="button" aria-label={open?translate('closeMenu'):translate('openMenu')} aria-expanded={open} aria-controls="user-account-navigation" onClick={()=>setOpen(value=>!value)}>{open?<X aria-hidden="true"/>:<Menu aria-hidden="true"/>}</button></div>
   <span className="user-topbar-identity"><span className="user-topbar-avatar">{(data.user.name||data.user.email||'A').trim().slice(0,1).toUpperCase()}</span><span><b>{data.user.name||data.user.email}</b><small>{tierLabel||'Account tier unavailable'}</small></span></span>
   {modeError&&<span className="user-mode-error" role="alert">{modeError}</span>}
  </div>
  <nav ref={userNavRef} id="user-account-navigation" aria-label="Account navigation" className={`nav-links user-account-sidebar ${open?'nav-open':''}`}>
   <div className="nav-account-snapshot"><span className="nav-account-monogram">{(data.user.name||data.user.email||'A').trim().slice(0,1).toUpperCase()}</span><span className="nav-account-copy"><small>ACCOUNT SPACE</small><b>{data.user.name||data.user.email}</b><em>{data.user.accountMode} ACCOUNT · {tierLabel||'TIER —'}</em></span></div>
   <section className="nav-menu-group" aria-label="Overview"><h2 className="nav-menu-section">OVERVIEW</h2><Link href="/dashboard" onClick={close} aria-current={pathname==='/dashboard'?'page':undefined}><LayoutDashboard size={16}/><span>Dashboard</span></Link></section>
   <section className="nav-menu-group" aria-label="Investing"><h2 className="nav-menu-section">INVESTING</h2><Link href="/trade" onClick={close} aria-current={active('/trade')?'page':undefined}><Activity size={16}/><span>Trade</span></Link><Link href="/markets" onClick={close} aria-current={active('/markets')?'page':undefined}><LineChart size={16}/><span>Markets</span></Link><Link href="/portfolio" onClick={close} aria-current={active('/portfolio')?'page':undefined}><BriefcaseBusiness size={16}/><span>Portfolio</span></Link><Link href="/investments" onClick={close} aria-current={active('/investments')?'page':undefined}><BriefcaseBusiness size={16}/><span>Investments</span></Link><Link href="/orders" onClick={close} aria-current={active('/orders')?'page':undefined}><History size={16}/><span>Orders &amp; activity</span></Link></section>
   <section className="nav-menu-group" aria-label="Account"><h2 className="nav-menu-section">ACCOUNT</h2><Link href="/wallet" onClick={close} aria-current={active('/wallet')?'page':undefined}><Wallet size={16}/><span>Wallet</span></Link><Link href="/notifications" onClick={close} aria-current={active('/notifications')?'page':undefined}><FileText size={16}/><span>Notifications</span></Link><Link href="/kyc" onClick={close} aria-current={active('/kyc')?'page':undefined}><ShieldCheck size={16}/><span>Identity verification</span></Link><Link href="/cards" onClick={close} aria-current={active('/cards')?'page':undefined}><CreditCard size={16}/><span>Cards</span></Link>{taxServicesAvailable&&<Link href="/tax-services" onClick={close} aria-current={active('/tax-services')?'page':undefined}><FileText size={16}/><span>Tax services</span></Link>}</section>
   <section className="nav-menu-group" aria-label="Profile and support"><h2 className="nav-menu-section">PROFILE &amp; SUPPORT</h2><Link href="/settings" onClick={close} aria-current={active('/settings')?'page':undefined}><Settings size={16}/><span>Profile &amp; security</span></Link><Link href="/support" onClick={close} aria-current={active('/support')?'page':undefined}><Mail size={16}/><span>Help &amp; support</span></Link></section>
   <div className="nav-menu-tools"><button type="button" className="nav-logout" disabled={loggingOut} aria-busy={loggingOut} onClick={()=>void logout()}><LogOut size={16} aria-hidden="true"/>{loggingOut?translate('signingOut'):translate('logout')}</button></div>
  </nav>
 </header>;
 return <header className={`site-nav ${status==='authenticated'?'site-nav-authenticated':''} ${status==='authenticated'&&data?.user?.role==='ADMIN'?'site-nav-admin':''}`}><div className="nav-inner">
   <Link href="/" className="brand" onClick={close}><Image src="/aurevia-logo.png" alt="Aurevia Invest" width={38} height={38}/><span>AUREVIA <b>INVEST</b></span></Link>
   <nav id="primary-navigation" aria-label="Primary navigation" className={`nav-links ${open?'nav-open':''}`} onKeyDown={event=>{if(event.key==='Escape')close()}}>
    {status==='loading'?<span className="muted text-sm" aria-live="polite">{translate('restoringSession')}</span>:<>
     {status==='unauthenticated'&&<section className="nav-menu-group" aria-labelledby="nav-access-heading">
      <h2 className="nav-menu-section" id="nav-access-heading">ACCOUNT ACCESS</h2>
      <Link href="/login" onClick={close}>{translate('signIn')}</Link>
      <Link href="/register" className="nav-cta" onClick={close}>{translate('createAccount')}</Link>
     </section>}
    {status==='authenticated'&&data?.user&&<div className="nav-account-snapshot"><span className="nav-account-monogram">{(data.user.name||data.user.email||'A').trim().slice(0,1).toUpperCase()}</span><span className="nav-account-copy"><small>ACCOUNT SPACE</small><b>{data.user.name||data.user.email}</b><em>{data.user.accountMode} ACCOUNT</em></span></div>}
     <section className="nav-menu-group" aria-labelledby="nav-overview-heading">
      <h2 className="nav-menu-section" id="nav-overview-heading">OVERVIEW</h2>
      <Link href="/" onClick={close} aria-current={pathname==='/'?'page':undefined}>{translate('home')}</Link>
      <Link href="/dashboard" onClick={close} aria-current={active('/dashboard')?'page':undefined}><LayoutDashboard size={16} aria-hidden="true"/>{translate('dashboard')}</Link>
      {status==='authenticated'&&data?.user?.role==='ADMIN'&&<Link href="/admin" className="nav-admin-entry" onClick={close} aria-current={active('/admin')?'page':undefined}><ShieldCheck size={16} aria-hidden="true"/>Open Admin Console</Link>}
     </section>
     <section className="nav-menu-group" aria-labelledby="nav-investing-heading">
      <h2 className="nav-menu-section" id="nav-investing-heading">INVESTING</h2>
      <Link href="/markets" onClick={close} aria-current={active('/markets')?'page':undefined}><LineChart size={16} aria-hidden="true"/>{translate('markets')}</Link>
      <Link href="/trade" onClick={close} aria-current={active('/trade')?'page':undefined}><ActivityIcon/>{translate('trade')}</Link>
      <Link href="/investments" onClick={close} aria-current={active('/investments')?'page':undefined}><BriefcaseBusiness size={16} aria-hidden="true"/>Opportunities</Link>
     </section>
     <section className="nav-menu-group" aria-labelledby="nav-portfolio-heading">
      <h2 className="nav-menu-section" id="nav-portfolio-heading">PORTFOLIO</h2>
      <Link href="/orders" onClick={close} aria-current={active('/orders')?'page':undefined}>{translate('orders')}</Link>
      <Link href="/wallet/transactions" onClick={close} aria-current={active('/wallet/transactions')?'page':undefined}><History size={16} aria-hidden="true"/>History</Link>
        <Link href="/broadcasts" onClick={close} aria-current={active('/broadcasts')?'page':undefined}><Radio size={16} aria-hidden="true"/>Live broadcasts</Link>
     </section>
     <section className="nav-menu-group" aria-labelledby="nav-account-heading">
      <h2 className="nav-menu-section" id="nav-account-heading">ACCOUNT &amp; SUPPORT</h2>
      <Link href="/wallet" onClick={close} aria-current={active('/wallet')?'page':undefined}><Wallet size={16} aria-hidden="true"/>{translate('wallet')}</Link>
      <Link href="/cards" onClick={close} aria-current={active('/cards')?'page':undefined}><CreditCard size={16} aria-hidden="true"/>Cards</Link>
      {status==='authenticated'&&taxServicesAvailable&&<Link href="/tax-services" onClick={close} aria-current={active('/tax-services')?'page':undefined}><FileText size={16} aria-hidden="true"/>Tax Services</Link>}
      <Link href="/kyc" onClick={close} aria-current={active('/kyc')?'page':undefined}><ShieldCheck size={16} aria-hidden="true"/>{translate('verification')}</Link>
      <Link href="/settings" onClick={close} aria-current={active('/settings')?'page':undefined}><Settings size={16} aria-hidden="true"/>{translate('settings')}</Link>
      <Link href="/notifications" onClick={close} aria-current={active('/notifications')?'page':undefined}>{translate('notifications')}</Link>
      <Link href="/support" onClick={close} aria-current={active('/support')?'page':undefined}>{translate('support')}</Link>
      <a className="nav-contact" href="tel:+12105047697" onClick={close}><PhoneCall size={16} aria-hidden="true"/><span><b>Call Support</b><small>+1 (210) 504-7697</small></span></a>
      <a className="nav-contact" href="mailto:aureviainvest@gmail.com" onClick={close}><Mail size={16} aria-hidden="true"/><span><b>Email</b><small>aureviainvest@gmail.com</small></span></a>
     </section>
     {status==='authenticated'&&data?.user&&<div className="nav-menu-tools">
      <div className="mode-switch-wrap">
        <span className="mode-switch-label">{translate('accountMode')}</span>
        <div className={`mode-toggle ${data.user.accountMode==='DEMO'?'is-demo':'is-real'} ${modeBusy?'is-busy':''}`} role="group" aria-label={translate('accountMode')}>
          <button
            type="button"
            className={`mode-toggle-option ${data.user.accountMode==='DEMO'?'is-active':''}`}
            aria-pressed={data.user.accountMode==='DEMO'}
            disabled={modeBusy||loggingOut||data.user.accountMode==='DEMO'}
            onClick={()=>void changeMode('DEMO')}
          >
            <span className="mode-toggle-dot" aria-hidden="true"/>
            {translate('demo')}
          </button>
          <button
            type="button"
            className={`mode-toggle-option ${data.user.accountMode==='REAL'?'is-active':''}`}
            aria-pressed={data.user.accountMode==='REAL'}
            disabled={modeBusy||loggingOut||data.user.accountMode==='REAL'}
            onClick={()=>void changeMode('REAL')}
          >
            <span className="mode-toggle-dot" aria-hidden="true"/>
            {translate('real')}
          </button>
          <span className="mode-toggle-slider" aria-hidden="true"/>
        </div>
        <p className="mode-toggle-hint">{data.user.accountMode==='DEMO'?'Demo account space':'Real account space'}</p>
      </div>
      {modeError&&<span className="text-xs text-loss" role="alert">{modeError}</span>}
      <button type="button" className="nav-logout" disabled={loggingOut} aria-busy={loggingOut} onClick={()=>void logout()}><LogOut size={16} aria-hidden="true"/>{loggingOut?translate('signingOut'):translate('logout')}</button>
     </div>}
    </>}
   </nav>
   <div className="nav-actions"><NotificationBell/><LanguageSelector/><button className="menu-button" type="button" aria-label={open?translate('closeMenu'):translate('openMenu')} aria-expanded={open} aria-controls="primary-navigation" onClick={()=>setOpen(!open)}>{open?<X aria-hidden="true"/>:<Menu aria-hidden="true"/>}</button></div>
 </div></header>
}

function ActivityIcon(){return <LineChart size={15} aria-hidden="true"/>}
