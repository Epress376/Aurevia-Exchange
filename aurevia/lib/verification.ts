import {Prisma} from '@prisma/client';
import {verificationConfig} from '@/lib/config';
import {generateVerificationCode,hashVerificationCode,availableVerificationChannel} from '@/lib/verification-delivery';

type VerificationStore=Prisma.TransactionClient;

export async function issueVerificationCode(tx:VerificationStore,user:{id:string;email:string;phone:string|null;name:string|null},channel=availableVerificationChannel(user.phone)){
	if(!channel)throw new Error('VERIFICATION_DELIVERY_UNAVAILABLE');
	const code=generateVerificationCode();
	const codeHash=hashVerificationCode(user.id,code);
	const now=new Date();
	const expiresAt=new Date(now.getTime()+verificationConfig.expiresInMinutes*60_000);
	const resendAfter=new Date(now.getTime()+verificationConfig.resendCooldownSeconds*1000);
	await tx.verificationCode.upsert({
		where:{userId:user.id},
		update:{codeHash,channel,providerReference:null,expiresAt,resendAfter,attempts:0},
		create:{userId:user.id,codeHash,channel,expiresAt,resendAfter},
	});
	return {code,codeHash,channel,resendAfter};
}