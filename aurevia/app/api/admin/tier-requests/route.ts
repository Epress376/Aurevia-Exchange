import {NextResponse} from 'next/server';
import {NotificationType,TierUpgradeStatus} from '@prisma/client';
import {z,ZodError} from 'zod';
import {requireAdmin} from '@/lib/auth';
import {db} from '@/lib/db';
import {createNotification} from '@/lib/notifications';
import {getAccountTier,validateTierThreeApproval,validateTierUpgradeApproval} from '@/lib/production-policy';
import {jsonSafe} from '@/lib/serializers';

const schema=z.object({
	id:z.string().min(1),
	status:z.nativeEnum(TierUpgradeStatus),
	reason:z.string().trim().min(3).max(1000),
});
const finalStatuses:TierUpgradeStatus[]=[TierUpgradeStatus.APPROVED,TierUpgradeStatus.REJECTED];

export async function GET(){
	try{
		await requireAdmin();
		const requests=await db.tierUpgradeRequest.findMany({
			include:{user:{select:{id:true,name:true,email:true,accountMode:true,kycStatus:true,approvedTier:true,kyc:{select:{submittedAt:true}},kycDocuments:{where:{kind:'IDENTITY_DOCUMENT'},select:{id:true,status:true}}}},reviewedBy:{select:{id:true,name:true,email:true}}},
			orderBy:[{status:'asc'},{createdAt:'asc'}],
			take:200,
		});
		return NextResponse.json(jsonSafe(requests),{headers:{'Cache-Control':'private, no-store'}});
	}catch(error){
		if(error instanceof Error&&error.message==='UNAUTHORIZED')return NextResponse.json({error:'Unauthorized'},{status:401});
		if(error instanceof Error&&error.message==='FORBIDDEN')return NextResponse.json({error:'Forbidden'},{status:403});
		console.error('Administrator tier review queue could not be loaded.');
		return NextResponse.json({error:'Tier review queue is temporarily unavailable.'},{status:503,headers:{'Cache-Control':'private, no-store'}});
	}
}

export async function PATCH(request:Request){
	try{
		const admin=await requireAdmin();
		const input=schema.parse(await request.json());
		const result=await db.$transaction(async tx=>{
			const current=await tx.tierUpgradeRequest.findUnique({where:{id:input.id}});
			if(!current)throw new Error('REQUEST_NOT_FOUND');
			if(finalStatuses.includes(current.status))throw new Error('REQUEST_ALREADY_FINAL');
			const reviewedAt=input.status===TierUpgradeStatus.NEEDS_INFORMATION?null:new Date();
			const updated=await tx.tierUpgradeRequest.update({where:{id:current.id},data:{status:input.status,adminReason:input.reason,reviewedById:admin.id,reviewedAt}});
			if(input.status===TierUpgradeStatus.APPROVED){
				const profile=await tx.user.findUniqueOrThrow({where:{id:current.userId},select:{accountMode:true,approvedTier:true,kycStatus:true,name:true,country:true,kyc:{select:{submittedAt:true}},kycDocuments:{where:{kind:'IDENTITY_DOCUMENT'},select:{status:true}}}});
				const approvedDocuments=profile.kycDocuments.filter(document=>document.status==='APPROVED').length;
				const actualTier=Number(getAccountTier({accountMode:profile.accountMode,kycStatus:profile.kycStatus,verificationDocuments:approvedDocuments,verificationSubmitted:!!profile.kyc?.submittedAt,approvedTier:profile.approvedTier}).label.at(-1));
				validateTierUpgradeApproval({requestCurrentTier:current.currentTier,requestedTier:current.requestedTier,currentTier:actualTier});
				if(current.requestedTier===3)validateTierThreeApproval({name:profile.name,country:profile.country,kycStatus:profile.kycStatus,verificationSubmitted:!!profile.kyc?.submittedAt,approvedIdentityDocuments:approvedDocuments});
				await tx.user.update({where:{id:current.userId},data:{approvedTier:Math.max(profile.approvedTier,current.requestedTier)}});
			}
			await tx.auditLog.create({data:{actorId:admin.id,action:'TIER_REQUEST_REVIEWED',entity:'TIER_REQUEST',entityId:current.id,metadata:{userId:current.userId,previousTier:current.currentTier,newTier:current.requestedTier,status:input.status,reason:input.reason}}});
			await createNotification(tx,{userId:current.userId,type:NotificationType.ACCOUNT,title:input.status==='APPROVED'?'Tier upgrade approved':input.status==='REJECTED'?'Tier request declined':input.status==='NEEDS_INFORMATION'?'More information requested':'Tier request reviewed',message:input.status==='APPROVED'?`Your account is now Tier ${current.requestedTier}. This does not enable real-money services.`:`An administrator updated your Tier ${current.requestedTier} request: ${input.reason}`,dedupeKey:`tier-request:${current.id}:${input.status}:${updated.updatedAt.toISOString()}`,relatedEntity:'TIER_REQUEST',relatedId:current.id,actionUrl:'/tier'});
			return updated;
		});
		return NextResponse.json(jsonSafe(result),{headers:{'Cache-Control':'private, no-store'}});
	}catch(error){
		if(error instanceof Error&&['UNAUTHORIZED','FORBIDDEN'].includes(error.message))return NextResponse.json({error:'Forbidden'},{status:403});
		if(error instanceof ZodError)return NextResponse.json({error:'Select a valid review outcome and provide a reason.'},{status:400});
		if(error instanceof Error&&error.message==='REQUEST_NOT_FOUND')return NextResponse.json({error:'Tier request not found.'},{status:404});
		if(error instanceof Error&&error.message==='REQUEST_ALREADY_FINAL')return NextResponse.json({error:'This tier request has already been finalized.'},{status:409});
		if(error instanceof Error&&error.message==='TIER_REQUEST_STALE')return NextResponse.json({error:'The account tier changed after this request. Refresh the review queue before deciding.'},{status:409});
		if(error instanceof Error&&error.message==='TIER_3_REQUIREMENTS_NOT_MET')return NextResponse.json({error:'Tier 3 approval requires a complete profile, approved identity status, and at least one approved identity document.'},{status:409});
		return NextResponse.json({error:'Unable to update the tier request.'},{status:503});
	}
}
