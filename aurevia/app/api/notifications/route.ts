import {NextResponse} from 'next/server';
import {z,ZodError} from 'zod';
import {requireUser} from '@/lib/auth';
import {db} from '@/lib/db';
import {jsonSafe} from '@/lib/serializers';

const updateSchema=z.discriminatedUnion('action',[
	z.object({action:z.literal('read'),id:z.string().min(1)}),
	z.object({action:z.literal('read-all')}),
]);

export async function GET(req:Request){
	try{
		const user=await requireUser();
		const limit=Math.min(Math.max(Number(new URL(req.url).searchParams.get('limit')||30),1),100);
		const [notifications,unreadCount]=await Promise.all([
			db.notification.findMany({where:{userId:user.id},orderBy:{createdAt:'desc'},take:limit}),
			db.notification.count({where:{userId:user.id,isRead:false}}),
		]);
		return NextResponse.json(jsonSafe({notifications,unreadCount}),{headers:{'Cache-Control':'private, no-store'}});
	}catch{
		return NextResponse.json({error:'Unauthorized'},{status:401});
	}
}

export async function PATCH(req:Request){
	try{
		const user=await requireUser();
		const input=updateSchema.parse(await req.json());
		if(input.action==='read'){
			const owned=await db.notification.findFirst({where:{id:input.id,userId:user.id},select:{id:true}});
			if(!owned)return NextResponse.json({error:'Notification not found.'},{status:404});
			await db.notification.updateMany({where:{id:owned.id,userId:user.id,isRead:false},data:{isRead:true}});
		}else{
			await db.notification.updateMany({where:{userId:user.id,isRead:false},data:{isRead:true}});
		}
		const unreadCount=await db.notification.count({where:{userId:user.id,isRead:false}});
		return NextResponse.json({ok:true,unreadCount});
	}catch(error){
		if(error instanceof ZodError)return NextResponse.json({error:'Invalid notification update.'},{status:400});
		return NextResponse.json({error:'Unauthorized'},{status:401});
	}
}