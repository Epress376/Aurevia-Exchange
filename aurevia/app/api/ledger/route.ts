import {NextResponse} from 'next/server';
import {requireUser} from '@/lib/auth';
import {db} from '@/lib/db';
import {balance} from '@/lib/ledger';
import {jsonSafe} from '@/lib/serializers';

export async function GET(req:Request){
  try{
    const u=await requireUser();
    const url=new URL(req.url);
    const limit=Math.min(Math.max(Number(url.searchParams.get('limit')||50),1),200);
    const account=await db.ledgerAccount.findUnique({where:{code:`USER:${u.id}:${u.accountMode}:USD`}});
    if(!account) return NextResponse.json(jsonSafe({balance:0,transactions:[]}));
    const [entries,bal]=await Promise.all([
      db.ledgerEntry.findMany({where:{accountId:account.id},include:{transaction:true},orderBy:{createdAt:'desc'},take:limit}),
      balance(db,account.id)
    ]);
    return NextResponse.json(jsonSafe({accountMode:u.accountMode,balance:bal,transactions:entries}));
  }catch{return NextResponse.json({error:'Unauthorized'},{status:401})}
}
