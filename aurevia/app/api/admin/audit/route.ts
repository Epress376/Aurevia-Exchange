import {NextResponse} from 'next/server';import {requireAdmin} from '@/lib/auth';import {db} from '@/lib/db';import {jsonSafe} from '@/lib/serializers';
export async function GET(request:Request){
	try{
		await requireAdmin();
		const loginUserId=new URL(request.url).searchParams.get('loginUserId');
		if(loginUserId){
			const events=await db.auditLog.findMany({where:{entity:'LOGIN',actorId:loginUserId},select:{id:true,actorId:true,action:true,entity:true,metadata:true,createdAt:true},orderBy:{createdAt:'desc'},take:100});
			return NextResponse.json(jsonSafe(events),{headers:{'Cache-Control':'private, no-store'}});
		}
		const [audit,notifications]=await Promise.all([db.auditLog.findMany({orderBy:{createdAt:'desc'},take:200}),db.notification.findMany({select:{id:true,type:true,title:true,createdAt:true},orderBy:{createdAt:'desc'},take:200})]);
		const events=[...audit.map(event=>({...event,summary:null})),...notifications.map(event=>({id:`notification:${event.id}`,createdAt:event.createdAt,action:`NOTIFICATION_${event.type}`,entity:'NOTIFICATION',entityId:event.id,summary:event.title}))].sort((a,b)=>b.createdAt.getTime()-a.createdAt.getTime()).slice(0,200);
		return NextResponse.json(jsonSafe(events),{headers:{'Cache-Control':'private, no-store'}});
	}catch{return NextResponse.json({error:'Forbidden'},{status:403})}
}
