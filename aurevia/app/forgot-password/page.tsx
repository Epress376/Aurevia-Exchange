'use client';

import {FormEvent,useState} from 'react';
import Link from 'next/link';
import Image from 'next/image';
import Nav from '@/components/Nav';

export default function ForgotPassword(){
	const [email,setEmail]=useState('');
	const [message,setMessage]=useState('');
	const [error,setError]=useState('');
	const [busy,setBusy]=useState(false);
	async function submit(event:FormEvent<HTMLFormElement>){
		event.preventDefault();if(busy)return;
		setBusy(true);setMessage('');setError('');
		try{
			const response=await fetch('/api/password-reset/request',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email})});
			const result=await response.json();
			if(!response.ok)throw new Error(result.error||'Password recovery is unavailable.');
			setMessage(result.message||'If an eligible account matches, recovery instructions may be emailed.');
		}catch(exception){setError(exception instanceof Error?exception.message:'Password recovery is unavailable.')}
		finally{setBusy(false)}
	}
	return <><Nav/><main className="auth-scene"><section className="auth-card" aria-labelledby="forgot-title"><div className="auth-brand"><Image src="/aurevia-logo.png" alt="" width={52} height={52} priority/><span>AUREVIA <b>INVEST</b></span></div><p className="account-kicker">ACCOUNT RECOVERY</p><h1 id="forgot-title" className="auth-heading">Forgot password?</h1><p className="auth-subtitle">Enter your account email. If it is eligible, a time-limited recovery link will be sent.</p><form onSubmit={submit} className="mt-5 space-y-4"><label className="auth-field-label">Email address<input className="auth-input" type="email" autoComplete="email" required maxLength={254} value={email} onChange={event=>setEmail(event.target.value)}/></label>{error&&<p className="auth-error" role="alert">{error}</p>}{message&&<p className="text-sm text-profit" role="status">{message}</p>}<button type="submit" className="auth-submit w-full" disabled={busy}>{busy?'Submitting…':'Request recovery link'}</button></form><p className="auth-footer"><Link href="/login" className="auth-link">Return to sign in</Link></p></section></main></>;
}