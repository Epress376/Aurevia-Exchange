import {createHash,randomBytes} from 'node:crypto';
import {isIP} from 'node:net';
import {NextResponse} from 'next/server';
import {z,ZodError} from 'zod';
import {db} from '@/lib/db';
import {isSmtpConfigured,sendEmail} from '@/lib/email';
import {rateLimit} from '@/lib/rate-limit';

export const dynamic='force-dynamic';

const schema=z.object({email:z.string().trim().email().max(254)});
const genericResponse={message:'If an eligible account matches, recovery instructions may be emailed. If no email arrives, contact support.'};

function getClientIp(request:Request){
	const forwarded=request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'';
	const real=request.headers.get('x-real-ip')?.trim()||'';
	return forwarded&&isIP(forwarded)?forwarded:real&&isIP(real)?real:'unknown';
}

export async function POST(request:Request){
	try{
		rateLimit(`password-reset-request:${getClientIp(request)}`,5,60*60_000);
		const input=schema.parse(await request.json());
		if(!isSmtpConfigured()){
			console.warn('Password reset is unavailable: SMTP configuration is missing.');
			return NextResponse.json({error:'Password recovery email is not configured. Contact support.'},{status:503});
		}
		const baseUrl=process.env.NEXT_PUBLIC_APP_URL||process.env.NEXTAUTH_URL;
		let resetUrl:string;
		try{resetUrl=new URL('/reset-password',baseUrl).toString()}catch{return NextResponse.json({error:'Password recovery URL is not configured.'},{status:503})}
		const email=input.email.toLowerCase();
		const user=await db.user.findUnique({where:{email},select:{id:true,email:true,status:true}});
		if(!user||user.status!=='ACTIVE')return NextResponse.json(genericResponse,{status:202});
		const token=randomBytes(32).toString('base64url');
		const tokenHash=createHash('sha256').update(token).digest('hex');
		const expiresAt=new Date(Date.now()+30*60_000);
		await db.$transaction(async tx=>{
			await tx.passwordResetToken.updateMany({where:{userId:user.id,consumedAt:null},data:{consumedAt:new Date()}});
			await tx.passwordResetToken.create({data:{userId:user.id,tokenHash,expiresAt}});
		});
		const delivery=await sendEmail({to:user.email,subject:'Aurevia Invest password recovery',text:`Use this one-time link to reset your password. It expires in 30 minutes.\n\n${resetUrl}?token=${encodeURIComponent(token)}\n\nIf you did not request this, ignore this email.`});
		if(!delivery.sent){
			await db.passwordResetToken.updateMany({where:{tokenHash,consumedAt:null},data:{consumedAt:new Date()}});
			return NextResponse.json(genericResponse,{status:202});
		}
		return NextResponse.json(genericResponse,{status:202});
	}catch(error){
		if(error instanceof ZodError)return NextResponse.json({error:'Enter a valid email address.'},{status:400});
		if(error instanceof Error&&error.message==='RATE_LIMITED')return NextResponse.json({error:'Too many recovery requests. Try again later.'},{status:429});
		const code=error&&typeof error==='object'&&'code' in error?String(error.code):'';
		if(['P1001','P1002','P1017'].includes(code))return NextResponse.json({error:'Password recovery is temporarily unavailable.'},{status:503});
		return NextResponse.json({error:'Password recovery is temporarily unavailable.'},{status:503});
	}
}