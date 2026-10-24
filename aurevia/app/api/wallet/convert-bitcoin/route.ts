import {AccountMode,Prisma,UserStatus} from '@prisma/client';
import {NextResponse} from 'next/server';
import {z,ZodError} from 'zod';
import {requireUser} from '@/lib/auth';
import {db} from '@/lib/db';
import {rateLimit} from '@/lib/rate-limit';
import {convertSimulatedBitcoinTx} from '@/lib/simulated-bitcoin';

const schema=z.object({
	direction:z.enum(['BUY','SELL']),
	amount:z.string().regex(/^(?:0|[1-9]\d{0,8})(?:\.\d{1,10})?$/),
});

export async function POST(request:Request){
	try{
		const user=await requireUser();
		if(user.accountMode!==AccountMode.DEMO)return NextResponse.json({error:'Simulated Bitcoin conversion is only available in the DEMO account.'},{status:409});
		const input=schema.parse(await request.json());
		const idempotencyKey=request.headers.get('Idempotency-Key')||'';
		if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idempotencyKey))return NextResponse.json({error:'A valid idempotency key is required.'},{status:400});
		rateLimit(`btc-conversion:${user.id}`,10,60_000);
		const amount=new Prisma.Decimal(input.amount);
		if(amount.lte(0)||input.direction==='BUY'&&amount.gt(100_000_000)||input.direction==='SELL'&&amount.gt(10_000))return NextResponse.json({error:'Conversion amount is outside the permitted range.'},{status:400});
		const conversion=await db.$transaction(async tx=>{
			const currentUser=await tx.user.findUniqueOrThrow({where:{id:user.id},select:{accountMode:true,status:true,accountRestricted:true}});
			if(currentUser.accountMode!==AccountMode.DEMO)throw new Error('DEMO_MODE_REQUIRED');
			if(currentUser.status!==UserStatus.ACTIVE||currentUser.accountRestricted)throw new Error('ACCOUNT_RESTRICTED');
			return convertSimulatedBitcoinTx(tx,{userId:user.id,direction:input.direction,amount,idempotencyKey});
		},{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
		return NextResponse.json(conversion,{status:conversion.replayed?200:201,headers:{'Cache-Control':'private, no-store'}});
	}catch(error){
		if(error instanceof ZodError)return NextResponse.json({error:'Enter a valid positive conversion amount.'},{status:400});
		if(error instanceof Error&&error.message==='UNAUTHORIZED')return NextResponse.json({error:'Unauthorized'},{status:401});
		if(error instanceof Error&&error.message==='RATE_LIMITED')return NextResponse.json({error:'Too many conversion requests. Please wait and try again.'},{status:429});
		if(error instanceof Error&&error.message==='INSUFFICIENT_DEMO_BALANCE')return NextResponse.json({error:'Insufficient DEMO USD balance.'},{status:409});
		if(error instanceof Error&&error.message==='INSUFFICIENT_POSITION')return NextResponse.json({error:'Insufficient available simulated BTC.'},{status:409});
		if(error instanceof Error&&error.message==='IDEMPOTENCY_KEY_REUSED')return NextResponse.json({error:'This request key was already used for a different conversion.'},{status:409});
		if(error instanceof Error&&error.message==='DEMO_MODE_REQUIRED')return NextResponse.json({error:'Switch to the DEMO account before converting simulated Bitcoin.'},{status:409});
		if(error instanceof Error&&error.message==='ACCOUNT_RESTRICTED')return NextResponse.json({error:'This account is not currently permitted to trade.'},{status:403});
		if(error instanceof Error&&error.message==='BITCOIN_INSTRUMENT_UNAVAILABLE')return NextResponse.json({error:'The simulated BTC/USD instrument is not available.'},{status:503});
		if(error instanceof Error&&error.message==='STALE_MARKET_QUOTE')return NextResponse.json({error:'The simulated BTC/USD reference price is stale. Please retry when market data is available.'},{status:503});
		if(error&&typeof error==='object'&&'code' in error&&String(error.code)==='P2034')return NextResponse.json({error:'The account changed during conversion. Retry with the same request key.'},{status:409});
		console.error('Simulated Bitcoin conversion failed.',error&&typeof error==='object'&&'code' in error?String(error.code):error instanceof Error?error.name:'UnknownError');
		return NextResponse.json({error:'Unable to complete the simulated Bitcoin conversion.'},{status:503});
	}
}
