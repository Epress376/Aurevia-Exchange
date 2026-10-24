import {NextResponse} from 'next/server';
import {db} from '@/lib/db';
import {jsonSafe} from '@/lib/serializers';

export async function GET(req:Request){
  const id=new URL(req.url).searchParams.get('instrumentId');
  if(!id)return NextResponse.json({error:'instrumentId is required'},{status:400});
  const instrument=await db.instrument.findUnique({where:{id}});
  if(!instrument)return NextResponse.json({error:'Instrument not found'},{status:404});
  const mid=Number(instrument.price);
  const tick=Math.max(Number(instrument.tickSize),mid*0.0001);
  const bids=Array.from({length:8},(_,i)=>({price:Math.max(0.000001,mid-tick*(i+1)),quantity:Number((0.25+Math.random()*4).toFixed(4))}));
  const asks=Array.from({length:8},(_,i)=>({price:mid+tick*(i+1),quantity:Number((0.25+Math.random()*4).toFixed(4))}));
  return NextResponse.json(jsonSafe({symbol:instrument.symbol,mid,bids,asks,updatedAt:new Date()}));
}
