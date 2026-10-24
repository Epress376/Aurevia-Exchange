import {registrationVerificationChannel,deliverVerificationCode,hasConfiguredVerificationProvider} from '@/lib/verification-delivery';
import {NextResponse} from 'next/server';
import {z,ZodError} from 'zod';
import {db} from '@/lib/db';
import {rateLimit} from '@/lib/rate-limit';
import {verificationConfig} from '@/lib/config';
import {generateVerificationCode,hashVerificationCode} from '@/lib/verification-delivery';

const schema=z.object({email:z.string().trim().email().max(254)});
const genericResponse={message:'If the account is eligible and past the cooldown, a replacement code was requested. Delivery is not guaranteed.',resendAfterSeconds:verificationConfig.resendCooldownSeconds};

export async function POST(req:Request){
	try{
		const {email:rawEmail}=schema.parse(await req.json());
		const email=rawEmail.toLowerCase();
		const ip=req.headers.get('x-forwarded-for')||'unknown';
		rateLimit(`verify-resend-ip:${ip}`,5,60*60_000);
		rateLimit(`verify-resend-email:${email}`,3,60*60_000);
		if(!hasConfiguredVerificationProvider())return NextResponse.json({error:'Verification delivery is not configured. No code was sent.'},{status:503});
		const user=await db.user.findUnique({where:{email},select:{id:true,email:true,phone:true,name:true,verifiedAt:true}});
		if(!user||user.verifiedAt)return NextResponse.json(genericResponse,{status:202});
		const challenge=await db.verificationCode.findUnique({where:{userId:user.id}});
		const now=new Date();
		if(challenge&&challenge.resendAfter>now)return NextResponse.json(genericResponse,{status:202});
		const channel=registrationVerificationChannel(user.phone);
		if(!channel)return NextResponse.json(genericResponse,{status:202});
		const code=generateVerificationCode();
		const codeHash=hashVerificationCode(user.id,code);
		const expiresAt=new Date(now.getTime()+verificationConfig.expiresInMinutes*60_000);
		const resendAfter=new Date(now.getTime()+verificationConfig.resendCooldownSeconds*1000);
		if(challenge){
			const updated=await db.verificationCode.updateMany({where:{id:challenge.id,resendAfter:{lte:now}},data:{codeHash,channel,expiresAt,resendAfter,attempts:0}});
			if(updated.count===1&&!await deliverVerificationCode(channel,user,code))await db.verificationCode.updateMany({where:{userId:user.id,codeHash},data:{resendAfter:now}});
		}else{
			try{
				const created=await db.verificationCode.create({data:{userId:user.id,codeHash,channel,expiresAt,resendAfter}});
				if(!await deliverVerificationCode(channel,user,code))await db.verificationCode.deleteMany({where:{id:created.id,codeHash}});
			}catch{}
		}
		return NextResponse.json(genericResponse,{status:202});
	}catch(error){
		if(error instanceof ZodError)return NextResponse.json({error:'Enter a valid email address.'},{status:400});
		if(error instanceof Error&&error.message==='RATE_LIMITED')return NextResponse.json(genericResponse,{status:202});
		return NextResponse.json(genericResponse,{status:202});
	}
}