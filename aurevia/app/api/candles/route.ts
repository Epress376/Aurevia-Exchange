import {NextResponse} from 'next/server';
import {db} from '@/lib/db';
import {jsonSafe} from '@/lib/serializers';

export async function GET(req:Request){
  const url=new URL(req.url); const instrumentId=url.searchParams.get('instrumentId');
  const limit=Math.min(Math.max(Number(url.searchParams.get('limit')||120),1),500);
  if(!instrumentId)return NextResponse.json({error:'instrumentId is required'},{status:400});
  const rows=await db.candle.findMany({where:{instrumentId},orderBy:{ts:'desc'},take:limit});
  return NextResponse.json(jsonSafe(rows.reverse()));
}
