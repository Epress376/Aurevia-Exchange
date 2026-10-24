import {NextResponse} from 'next/server';
import {requireUser} from '@/lib/auth';
import {db} from '@/lib/db';
import {ensureCardCatalog} from '@/lib/cards';
import {jsonSafe} from '@/lib/serializers';

export async function GET(){
	try{
		await requireUser();
		await ensureCardCatalog();
		const items=await db.cardCatalogItem.findMany({where:{enabled:true},orderBy:{orderPrice:'asc'}});
		return NextResponse.json(jsonSafe({items}),{headers:{'Cache-Control':'private, no-store'}});
	}catch{
		return NextResponse.json({error:'Unauthorized'},{status:401});
	}
}
