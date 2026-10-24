import {NextResponse} from 'next/server';
import {requireUser} from '@/lib/auth';
import {db} from '@/lib/db';
import {jsonSafe} from '@/lib/serializers';

export async function GET(){
	try{
		const user=await requireUser();
		const [cards,applications]=await Promise.all([
			db.simulatedCard.findMany({where:{userId:user.id},orderBy:{issuedAt:'desc'}}),
			db.cardApplication.findMany({where:{userId:user.id},include:{catalogItem:{select:{displayName:true,key:true}}},orderBy:{createdAt:'desc'},take:50}),
		]);
		return NextResponse.json(jsonSafe({cards,applications}),{headers:{'Cache-Control':'private, no-store'}});
	}catch{
		return NextResponse.json({error:'Unauthorized'},{status:401});
	}
}
