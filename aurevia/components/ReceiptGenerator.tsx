'use client';

import {useRef,useState} from 'react';
import {ChevronDown,Download,Printer,X} from 'lucide-react';
import html2canvas from 'html2canvas-pro';
import {jsPDF} from 'jspdf';
import {formatUsd} from '@/lib/currency-format';

export type ReceiptData={
	id:string;
	reference:string;
	status:'PENDING'|'PENDING_REVIEW'|'PROCESSING'|'APPROVED'|'COMPLETED'|'REJECTED'|'FAILED'|'CANCELLED';
	type?:'DEPOSIT'|'WITHDRAWAL'|'CREDIT'|'DEBIT';
	accountMode?:'DEMO'|'REAL';
	simulated?:boolean;
	isWithdrawal?:boolean;
	createdAt:string;
	reviewedAt?:string|null;
	completedAt?:string|null;
	reviewedBy?:{name:string|null}|null;
	accountReference?:string|null;
	externalReference?:string|null;
	processingReference?:string|null;
	previousBalance?:number|string|null;
	resultingBalance?:number|string|null;
	adminNote?:string|null;
	name:string;
	email:string;
	amount:number|string;
	currency:string;
	creditedCurrency?:string|null;
	method:string;
	creditedAmount?:number|string;
	recipientName?:string|null;
	recipientNumber?:string|null;
	sourceName?:string|null;
	sourceNumber?:string|null;
	destinationName?:string|null;
	destinationNumber?:string|null;
	purpose?:string|null;
	fee?:number|string|null;
	gateway?:string|null;
};

const dateLabel=(value:string)=>{
	const date=new Date(value);
	return Number.isNaN(date.getTime())?'Not recorded':new Intl.DateTimeFormat('en-US',{dateStyle:'medium',timeStyle:'short',timeZone:'UTC'}).format(date);
};
const amountLabel=(value:number|string,currency:string)=>{
	const amount=Number(value);
	if(!Number.isFinite(amount))return '—';
	return currency==='USD'?formatUsd(Math.abs(amount)):`${Math.abs(amount).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:8})} ${currency}`;
};

export default function ReceiptGenerator({receipt}:{receipt:ReceiptData}){
	const receiptRef=useRef<HTMLElement>(null);
	const [busy,setBusy]=useState(false);
	const [error,setError]=useState('');
	const [visible,setVisible]=useState(true);
	const [showDetails,setShowDetails]=useState(false);
	const currentReceipt=receipt;

	const kind=currentReceipt.type||'DEPOSIT';
	const isWithdrawal=currentReceipt.isWithdrawal===true||kind==='WITHDRAWAL';
	const isSuccessful=currentReceipt.status==='COMPLETED'||(currentReceipt.status==='APPROVED'&&!isWithdrawal);
	const isFailed=currentReceipt.status==='REJECTED'||currentReceipt.status==='FAILED'||currentReceipt.status==='CANCELLED';
	const statusLabel=currentReceipt.status==='APPROVED'&&isWithdrawal
		?'Approved · payout not confirmed'
		:currentReceipt.status==='APPROVED'?'Approved'
		:currentReceipt.status==='COMPLETED'&&isWithdrawal?'Completed · admin-recorded payout'
		:currentReceipt.status==='COMPLETED'?'Completed'
		:currentReceipt.status==='REJECTED'?'Rejected'
		:currentReceipt.status==='FAILED'?'Failed'
		:currentReceipt.status==='CANCELLED'?'Cancelled'
		:currentReceipt.status==='PENDING_REVIEW'?'Pending review'
		:currentReceipt.status==='PROCESSING'?'Processing'
		:'Pending';
	const receiptTitle=kind==='WITHDRAWAL'
		?currentReceipt.status==='COMPLETED'?'Withdrawal processing record':'Withdrawal request confirmation'
		:kind==='DEPOSIT'
			?currentReceipt.status==='APPROVED'||currentReceipt.status==='COMPLETED'?'Internal deposit ledger record':'Deposit request confirmation'
			:kind==='CREDIT'?'Account credit record':'Account debit record';
	const amountDescription=isWithdrawal?'Requested amount':kind==='DEPOSIT'&&currentReceipt.status!=='APPROVED'&&currentReceipt.status!=='COMPLETED'?'Requested amount':kind==='DEPOSIT'?'Ledger credit':'Recorded amount';
	const recipientName=currentReceipt.recipientName||currentReceipt.destinationName||(isWithdrawal?'Saved destination':'Aurevia internal ledger');
	const recipientNumber=currentReceipt.recipientNumber||currentReceipt.destinationNumber||(isWithdrawal?'Sensitive destination details are masked':'Internal account entry');
	const gateway=currentReceipt.gateway||(currentReceipt.accountMode==='REAL'?'Internal Aurevia ledger':'DEMO paper ledger');
	const fileName=`aurevia-${kind.toLowerCase()}-${currentReceipt.status.toLowerCase()}-${currentReceipt.id}`;
	const statusExplanation=isWithdrawal
		?currentReceipt.status==='COMPLETED'
			?'An administrator recorded the external processing reference and corresponding Aurevia ledger debit. Aurevia did not independently verify a bank or blockchain provider.'
			:currentReceipt.status==='APPROVED'
				?'The request is approved and the amount remains reserved. No external payout has been confirmed.'
				:currentReceipt.status==='PROCESSING'
					?'An administrator is processing the request. This status is not proof of payment.'
					:currentReceipt.status==='REJECTED'||currentReceipt.status==='FAILED'||currentReceipt.status==='CANCELLED'
						?'The request did not complete. No successful payout is represented by this receipt.'
						:'This confirms receipt of your withdrawal request only. It is not proof of payment.'
		:'This record reflects the current status in Aurevia’s internal account ledger; it is not a bank or payment-provider receipt.';

	async function exportReceipt(format:'png'|'pdf'){
		if(!receiptRef.current||busy)return;
		setBusy(true);setError('');
		try{
			const element=receiptRef.current;
			const originalMaxHeight=element.style.maxHeight;
			const originalOverflowY=element.style.overflowY;
			let canvas:HTMLCanvasElement;
			element.style.maxHeight='none';
			element.style.overflowY='visible';
			try{canvas=await html2canvas(element,{scale:2,backgroundColor:'#ffffff',logging:false,useCORS:true});}
			finally{element.style.maxHeight=originalMaxHeight;element.style.overflowY=originalOverflowY;}
			if(format==='png'){
				const link=document.createElement('a');link.download=`${fileName}.png`;link.href=canvas.toDataURL('image/png');link.click();
			}else{
				const pdf=new jsPDF({orientation:'portrait',unit:'px',format:[canvas.width,canvas.height]});
				pdf.addImage(canvas.toDataURL('image/png'),'PNG',0,0,canvas.width,canvas.height);
				pdf.save(`${fileName}.pdf`);
			}
		}catch(exception){
			console.error('Unable to export receipt:',exception instanceof Error?exception.message:'Unknown error');
			setError('This receipt could not be exported. Please try again.');
		}finally{setBusy(false)}
	}

	if(!visible)return <button type="button" className="min-h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm" onClick={()=>setVisible(true)}>View transaction receipt</button>;

	return <div className="aurevia-receipt-wrap">
		<article ref={receiptRef} className="receipt-container aurevia-receipt" aria-label={`${receiptTitle} ${currentReceipt.status.toLowerCase().replaceAll('_',' ')} receipt`}>
			<header className="receipt-brand-header">
				<div className="receipt-brand-lockup"><span aria-hidden="true">A</span><div><b>AUREVIA</b><small>INVEST · INTERNAL RECORD</small></div></div>
				<button type="button" className="receipt-close no-print" aria-label="Close receipt" onClick={()=>setVisible(false)}><X size={17}/></button>
			</header>
			<div className="receipt-inner">
				<div className="receipt-title-row"><div><span className="receipt-kicker">TRANSACTION DOCUMENT</span><h2>{receiptTitle}</h2></div><p className={`receipt-status ${isSuccessful?'is-success':isFailed?'is-failed':'is-pending'}`}><i aria-hidden="true"/>{statusLabel}</p></div>
				<div className="receipt-amount-row"><div><small>{amountDescription}</small><b>{amountLabel(currentReceipt.amount,currentReceipt.currency)}</b></div><div><small>Transaction date</small><b>{dateLabel(currentReceipt.createdAt)}</b></div></div>
				<div className="receipt-rule"/>
				<section className="receipt-information" aria-label="Transaction details">
					<h3>Transaction details</h3>
					<dl>
						<ReceiptRow label="Transaction reference" value={currentReceipt.reference}/>
						<ReceiptRow label="Transaction type" value={`${kind.replaceAll('_',' ')} · ${currentReceipt.method}`}/>
						{currentReceipt.accountMode&&<ReceiptRow label="Account mode" value={`${currentReceipt.accountMode} ${currentReceipt.accountMode==='DEMO'?'virtual':'internal ledger'}`}/>}
						{isWithdrawal&&<ReceiptRow label="Destination" value={`${recipientName} · ${recipientNumber}`}/>}
						{currentReceipt.fee!==null&&currentReceipt.fee!==undefined?<ReceiptRow label="Configured fee" value={amountLabel(currentReceipt.fee,currentReceipt.currency)}/>:isWithdrawal&&<ReceiptRow label="Fee / payout conversion" value="Not configured; no net payout estimate is available."/>}
						{currentReceipt.processingReference&&<ReceiptRow label="Administrator-recorded external reference" value={currentReceipt.processingReference}/>}
						{currentReceipt.creditedAmount!==undefined&&currentReceipt.creditedAmount!==null&&<ReceiptRow label="Aurevia ledger credit" value={amountLabel(currentReceipt.creditedAmount,currentReceipt.creditedCurrency||currentReceipt.currency)}/>}
						{currentReceipt.externalReference&&currentReceipt.externalReference!==currentReceipt.processingReference&&<ReceiptRow label="User-provided reference · unverified" value={currentReceipt.externalReference}/>}
						{currentReceipt.reviewedAt&&<ReceiptRow label="Administrator reviewed" value={dateLabel(currentReceipt.reviewedAt)}/>}
						{currentReceipt.completedAt&&<ReceiptRow label="Ledger debit posted" value={dateLabel(currentReceipt.completedAt)}/>}
					</dl>
				</section>
				<p className={`receipt-explanation ${isWithdrawal&&currentReceipt.status==='COMPLETED'?'is-complete':''}`}>{statusExplanation}</p>
				<details className="receipt-additional no-print" open={showDetails}>
					<summary aria-expanded={showDetails} onClick={event=>{event.preventDefault();setShowDetails(value=>!value)}}><span>Additional reference details</span><ChevronDown size={15} className={showDetails?'rotate-180':''}/></summary>
					<dl hidden={!showDetails}>
						{currentReceipt.accountReference&&<ReceiptRow label="Internal account reference" value={currentReceipt.accountReference}/>}
						{currentReceipt.reviewedBy?.name&&<ReceiptRow label="Reviewed by" value={currentReceipt.reviewedBy.name}/>}
						{currentReceipt.previousBalance!==null&&currentReceipt.previousBalance!==undefined&&<ReceiptRow label="Previous balance" value={amountLabel(currentReceipt.previousBalance,currentReceipt.currency)}/>}
						{currentReceipt.resultingBalance!==null&&currentReceipt.resultingBalance!==undefined&&<ReceiptRow label="Resulting balance" value={amountLabel(currentReceipt.resultingBalance,currentReceipt.currency)}/>}
						{currentReceipt.adminNote&&<ReceiptRow label="Administrator note" value={currentReceipt.adminNote}/>}
						<ReceiptRow label="Ledger classification" value={gateway}/>
					</dl>
				</details>
				{currentReceipt.simulated&&<p className="receipt-explanation">INTERNAL LEDGER RECORD · This record documents an Aurevia account entry only. It is not proof of external funds received or transferred.</p>}
				<footer className="receipt-footer"><span>Aurevia Invest · Internal platform record</span>{kind==='WITHDRAWAL'&&<a href={`/wallet/transactions/${encodeURIComponent(currentReceipt.id)}`}>Verify request record in Aurevia</a>}</footer>
			</div>
		</article>
		<div className="receipt-actions no-print">
			<button type="button" className="receipt-action" onClick={()=>window.print()}><Printer size={14}/>Print / Save as PDF</button>
			<button type="button" className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm disabled:opacity-60" disabled={busy} onClick={()=>void exportReceipt('png')}><Download size={14}/>{busy?'Preparing…':'Download PNG'}</button>
			<button type="button" className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm disabled:opacity-60" disabled={busy} onClick={()=>void exportReceipt('pdf')}><Download size={14}/>{busy?'Preparing…':'Download PDF'}</button>
		</div>
		{error&&<p className="text-sm text-rose-700" role="alert">{error}</p>}
	</div>;
}

function ReceiptRow({label,value}:{label:string;value:string}){return <div className="receipt-row"><dt>{label}</dt><dd>{value||'Not provided'}</dd></div>}
