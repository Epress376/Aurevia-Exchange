import {NotificationType,Prisma,PrismaClient} from '@prisma/client';

type NotificationStore=PrismaClient|Prisma.TransactionClient;

export async function createNotification(tx:NotificationStore,input:{
	userId:string;
	type:NotificationType;
	title:string;
	message:string;
	dedupeKey:string;
	actionUrl?:string;
	relatedEntity?:string;
	relatedId?:string;
}){
	return tx.notification.upsert({
		where:{dedupeKey:input.dedupeKey},
		update:{},
		create:input,
	});
}

export async function notifyActiveAdmins(tx:NotificationStore,input:Omit<Parameters<typeof createNotification>[1],'userId'|'dedupeKey'> & {dedupeKey:string}){
	const admins=await tx.user.findMany({where:{role:'ADMIN',status:'ACTIVE'},select:{id:true}});
	return Promise.all(admins.map(admin=>createNotification(tx,{...input,userId:admin.id,dedupeKey:`admin:${admin.id}:${input.dedupeKey}`})));
}