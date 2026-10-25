import {randomUUID} from 'node:crypto';
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
	const notification=await tx.notification.upsert({
		where:{dedupeKey:input.dedupeKey},
		update:{},
		create:input,
	});
	await tx.pushOutbox.upsert({
		where:{notificationId:notification.id},
		update:{},
		create:{notificationId:notification.id,userId:input.userId},
	});
	return notification;
}

export async function notifyActiveAdmins(tx:NotificationStore,input:Omit<Parameters<typeof createNotification>[1],'userId'|'dedupeKey'> & {dedupeKey:string}){
	const admins=await tx.user.findMany({where:{role:'ADMIN',status:'ACTIVE'},select:{id:true}});
	return Promise.all(admins.map(admin=>createNotification(tx,{...input,userId:admin.id,dedupeKey:`admin:${admin.id}:${input.dedupeKey}`})));
}

export async function notifyActiveUsers(tx:NotificationStore,input:Omit<Parameters<typeof createNotification>[1],'userId'|'dedupeKey'> & {dedupeKey:string}){
	const users=await tx.user.findMany({where:{role:'USER',status:'ACTIVE'},select:{id:true}});
	if(!users.length)return;
	const notifications=users.map(user=>({
		id:randomUUID(),
		userId:user.id,
		type:input.type,
		title:input.title,
		message:input.message,
		dedupeKey:`${input.dedupeKey}:${user.id}`,
		relatedEntity:input.relatedEntity,
		relatedId:input.relatedId,
		actionUrl:input.actionUrl,
	}));
	await tx.notification.createMany({data:notifications,skipDuplicates:true});
	const inserted=await tx.notification.findMany({where:{dedupeKey:{in:notifications.map(notification=>notification.dedupeKey)}},select:{id:true,userId:true}});
	await tx.pushOutbox.createMany({
		data:inserted.map(notification=>({id:randomUUID(),notificationId:notification.id,userId:notification.userId})),
		skipDuplicates:true,
	});
}