import {NextResponse} from 'next/server';
import {NotificationType,TierUpgradeStatus} from '@prisma/client';
import {z,ZodError} from 'zod';
import {requireUser} from '@/lib/auth';
import {db} from '@/lib/db';
import {createNotification,notifyActiveAdmins} from '@/lib/notifications';
import {getAccountTier} from '@/lib/production-policy';
import {rateLimit} from '@/lib/rate-limit';
import {jsonSafe} from '@/lib/serializers';

const schema=z.object({message:z.string().trim().max(1000).optional()});
const replySchema=z.object({id:z.string().min(1),message:z.string().trim().min(3).max(1000)});
const openStatuses:TierUpgradeStatus[]=[TierUpgradeStatus.PENDING_REVIEW,TierUpgradeStatus.NEEDS_INFORMATION];

export async function GET(){
	try{
		const user=await requireUser();
		const [profile,requests]=await Promise.all([
			db.user.findUnique({where:{id:user.id},select:{id:true,accountMode:true,approvedTier:true,kycStatus:true,name:true,country:true,kyc:{select:{submittedAt:true}},kycDocuments:{where:{kind:'IDENTITY_DOCUMENT'},select:{id:true,status:true}}}}),
			db.tierUpgradeRequest.findMany({where:{userId:user.id},orderBy:{createdAt:'desc'},select:{id:true,currentTier:true,requestedTier:true,status:true,userMessage:true,adminReason:true,reviewedAt:true,createdAt:true,updatedAt:true}}),
		]);
		if(!profile)return NextResponse.json({error:'Profile not found.'},{status:404});
		const tier=getAccountTier({accountMode:profile.accountMode,kycStatus:profile.kycStatus,verificationDocuments:profile.kycDocuments.filter(item=>item.status==='APPROVED').length,verificationSubmitted:!!profile.kyc?.submittedAt,approvedTier:profile.approvedTier});
		return NextResponse.json(jsonSafe({tier:tier.label,currentTier:Number(tier.label.at(-1)),canRequest:Number(tier.label.at(-1))<3&& !requests.some(request=>openStatuses.includes(request.status)),requirements:{profileComplete:!!profile.name&&!!profile.country,verificationSubmitted:!!profile.kyc?.submittedAt,identityDocumentUploaded:profile.kycDocuments.length>0,identityDocumentApproved:profile.kycDocuments.some(item=>item.status==='APPROVED')},requests}),{headers:{'Cache-Control':'private, no-store'}});
	}catch(error){
		return NextResponse.json({error:error instanceof Error&&error.message==='UNAUTHORIZED'?'Unauthorized':'Unable to load tier review status.'},{status:error instanceof Error&&error.message==='UNAUTHORIZED'?401:503});
	}
}

export async function POST(request:Request){
	try{
		const user=await requireUser();
		rateLimit(`tier-request:${user.id}`,3,60*60_000);
		const input=schema.parse(await request.json());
		const result=await db.$transaction(async tx=>{
			const profile=await tx.user.findUniqueOrThrow({where:{id:user.id},select:{id:true,accountMode:true,approvedTier:true,kycStatus:true,name:true,country:true,kyc:{select:{submittedAt:true}},kycDocuments:{where:{kind:'IDENTITY_DOCUMENT'},select:{id:true,status:true}}}});
			const tier=getAccountTier({accountMode:profile.accountMode,kycStatus:profile.kycStatus,verificationDocuments:profile.kycDocuments.filter(item=>item.status==='APPROVED').length,verificationSubmitted:!!profile.kyc?.submittedAt,approvedTier:profile.approvedTier});
			const currentTier=Number(tier.label.at(-1));
			if(currentTier>=3)throw new Error('MAXIMUM_TIER');
			if(!profile.name||!profile.country)throw new Error('PROFILE_INCOMPLETE');
			if(currentTier===2&&(!profile.kyc?.submittedAt||profile.kycDocuments.length===0))throw new Error('VERIFICATION_MISSING');
			const active=await tx.tierUpgradeRequest.findFirst({where:{userId:user.id,status:{in:openStatuses}}});
			if(active)throw new Error('REQUEST_PENDING');
			const requestRecord=await tx.tierUpgradeRequest.create({data:{userId:user.id,currentTier,requestedTier:currentTier+1,userMessage:input.message||null}});
			await tx.auditLog.create({data:{actorId:user.id,action:'TIER_UPGRADE_REQUESTED',entity:'TIER_REQUEST',entityId:requestRecord.id,metadata:{currentTier,requestedTier:currentTier+1}}});
			await createNotification(tx,{userId:user.id,type:NotificationType.ACCOUNT,title:'Tier review requested',message:`Your request to move from Tier ${currentTier} to Tier ${currentTier+1} is awaiting administrator review.`,dedupeKey:`tier-request:${requestRecord.id}:user`,relatedEntity:'TIER_REQUEST',relatedId:requestRecord.id,actionUrl:'/tier'});
			await notifyActiveAdmins(tx,{type:NotificationType.ACCOUNT,title:'Tier review requested',message:`A user submitted a Tier ${currentTier+1} review request.`,dedupeKey:`tier-request:${requestRecord.id}:admin`,relatedEntity:'TIER_REQUEST',relatedId:requestRecord.id,actionUrl:'/admin/tiers'});
			return requestRecord;
		});
		return NextResponse.json(jsonSafe(result),{status:201,headers:{'Cache-Control':'private, no-store'}});
	}catch(error){
		if(error instanceof ZodError)return NextResponse.json({error:'Provide a valid optional note of at most 1,000 characters.'},{status:400});
		if(error instanceof Error&&error.message==='UNAUTHORIZED')return NextResponse.json({error:'Unauthorized'},{status:401});
		if(error instanceof Error&&error.message==='RATE_LIMITED')return NextResponse.json({error:'You have submitted several tier requests recently. Try again later.'},{status:429});
		const messages:Record<string,string>={MAXIMUM_TIER:'You are already at the highest available tier.',PROFILE_INCOMPLETE:'Complete your name and country in Profile before requesting a tier review.',VERIFICATION_MISSING:'Submit your identity details and upload an identity document before requesting Tier 3 review.',REQUEST_PENDING:'A tier request is already awaiting review.'};
		if(error instanceof Error&&messages[error.message])return NextResponse.json({error:messages[error.message]},{status:409});
		const code=error&&typeof error==='object'&&'code' in error?String(error.code):'';
		if(code==='P2002')return NextResponse.json({error:'A tier request is already awaiting review.'},{status:409});
		console.error('Tier upgrade request could not be saved.');
		return NextResponse.json({error:'Unable to submit the tier review request.'},{status:503});
	}
}

export async function PATCH(request:Request){
	try{
		const user=await requireUser();
		rateLimit(`tier-request-reply:${user.id}`,3,60*60_000);
		const input=replySchema.parse(await request.json());
		const result=await db.$transaction(async tx=>{
			const current=await tx.tierUpgradeRequest.findFirst({where:{id:input.id,userId:user.id,status:TierUpgradeStatus.NEEDS_INFORMATION}});
			if(!current)throw new Error('REQUEST_NOT_FOUND');
			const updated=await tx.tierUpgradeRequest.update({where:{id:current.id},data:{userMessage:input.message,status:TierUpgradeStatus.PENDING_REVIEW,reviewedById:null,reviewedAt:null}});
			await tx.auditLog.create({data:{actorId:user.id,action:'TIER_REQUEST_INFORMATION_SUBMITTED',entity:'TIER_REQUEST',entityId:current.id,metadata:{requestedTier:current.requestedTier}}});
			await createNotification(tx,{userId:user.id,type:NotificationType.ACCOUNT,title:'Tier review information submitted',message:`Your additional information for Tier ${current.requestedTier} review was sent to an administrator.`,dedupeKey:`tier-request:${current.id}:user-reply:${updated.updatedAt.toISOString()}`,relatedEntity:'TIER_REQUEST',relatedId:current.id,actionUrl:'/tier'});
			await notifyActiveAdmins(tx,{type:NotificationType.ACCOUNT,title:'Tier review information received',message:`A user submitted additional information for tier request ${current.id}.`,dedupeKey:`tier-request:${current.id}:admin-reply:${updated.updatedAt.toISOString()}`,relatedEntity:'TIER_REQUEST',relatedId:current.id,actionUrl:'/admin/tiers'});
			return updated;
		});
		return NextResponse.json(jsonSafe(result),{headers:{'Cache-Control':'private, no-store'}});
	}catch(error){
		if(error instanceof ZodError)return NextResponse.json({error:'Provide a response of at least 3 and at most 1,000 characters.'},{status:400});
		if(error instanceof Error&&error.message==='UNAUTHORIZED')return NextResponse.json({error:'Unauthorized'},{status:401});
		if(error instanceof Error&&error.message==='RATE_LIMITED')return NextResponse.json({error:'You have submitted several tier responses recently. Try again later.'},{status:429});
		if(error instanceof Error&&error.message==='REQUEST_NOT_FOUND')return NextResponse.json({error:'No tier request is waiting for your information.'},{status:404});
		return NextResponse.json({error:'Unable to submit tier review information.'},{status:503});
	}
}
