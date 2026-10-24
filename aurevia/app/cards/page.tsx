'use client';

import {useCallback,useEffect,useState} from 'react';
import Link from 'next/link';
import {CreditCard,Plus} from 'lucide-react';
import Nav from '@/components/Nav';
import AureviaCardVisual from '@/components/AureviaCardVisual';

type Card={id:string;displayName:string;cardholderName:string;designTier:'SIGNATURE'|'GOLD'|'BLACK';referenceNumber:string;maskedPan:string;expiryMonth:number;expiryYear:number;status:string};
type AppRow={id:string;reference:string;status:string;designTier:string;priceSnapshot:string;currencySnapshot:string;catalogItem:{displayName:string}};

export default function CardsPage(){
	const [cards,setCards]=useState<Card[]>([]);
	const [applications,setApplications]=useState<AppRow[]>([]);
	const [error,setError]=useState('');
	const [loading,setLoading]=useState(true);

	const load=useCallback(async()=>{
		setLoading(true);
		try{
			const response=await fetch('/api/cards/mine',{cache:'no-store'});
			const result=await response.json();
			if(!response.ok)throw new Error(result.error||'Unable to load cards.');
			setCards(result.cards||[]);setApplications(result.applications||[]);setError('');
		}catch(exception){setError(exception instanceof Error?exception.message:'Unable to load cards.')}
		finally{setLoading(false)}
	},[]);

	useEffect(()=>{void load()},[load]);

	return <>
		<Nav/>
		<main className="account-page">
			<header className="account-heading">
				<div><span className="account-kicker">CARD CENTER</span><h1>Your cards</h1><p>Aurevia card designs linked to your account.</p></div>
				<Link href="/cards/apply" className="btn bg-gold text-black"><Plus size={14}/> Apply</Link>
			</header>
			{loading&&<p className="muted">Loading…</p>}
			{error&&<p className="text-loss text-sm" role="alert">{error}</p>}
			{!loading&&cards.length===0&&applications.length===0&&(
				<section className="card p-5"><p className="muted">No cards yet. Apply for an Aurevia card design to get started.</p></section>
			)}
			<div className="grid gap-6 mt-2">
				{cards.map(card=>(
					<section key={card.id} className="card p-5">
						<AureviaCardVisual designTier={card.designTier} cardholderName={card.cardholderName} maskedPan={card.maskedPan} expiryMonth={card.expiryMonth} expiryYear={card.expiryYear} displayName={card.displayName}/>
						<div className="mt-4 flex flex-wrap justify-between gap-2">
							<div>
								<p className="text-sm"><b>{card.displayName}</b> · {card.status.replaceAll('_',' ')}</p>
								<p className="text-xs muted">Ref {card.referenceNumber}</p>
							</div>
							<Link className="text-link" href={`/cards/${card.id}`}>Details</Link>
						</div>
						<p className="card-disclosure">See card details for product terms.</p>
					</section>
				))}
			</div>
			{applications.length>0&&(
				<section className="card p-5 mt-4">
					<h2 className="font-semibold flex items-center gap-2"><CreditCard size={16}/> Applications</h2>
					<ul className="mt-3 divide-y divide-white/10">{applications.map(app=>(
						<li key={app.id} className="py-3 text-sm flex flex-wrap justify-between gap-2">
							<span>{app.catalogItem.displayName} · {app.reference}</span>
							<span className="muted">{app.status.replaceAll('_',' ')} · {app.priceSnapshot} {app.currencySnapshot}</span>
						</li>
					))}</ul>
				</section>
			)}
		</main>
	</>;
}
