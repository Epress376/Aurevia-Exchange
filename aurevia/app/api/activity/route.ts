import {NextResponse} from 'next/server';
import {AccountMode} from '@prisma/client';
import {requireUser} from '@/lib/auth';
import {activityCategoryLabel,getUserActivity,isActivityCategory} from '@/lib/activity';

export const dynamic='force-dynamic';

export async function GET(request:Request){
  try{
    const user=await requireUser();
    const params=new URL(request.url).searchParams;
    const category=params.get('category')||'all';
    const rawLimit=params.get('limit')||'20';
    const limit=Math.min(100,Math.max(1,Number.parseInt(rawLimit,10)||20));
    if(!isActivityCategory(category))return NextResponse.json({error:'Unsupported activity category.'},{status:400});
    const result=await getUserActivity(user.id,user.accountMode as AccountMode,category,limit);
    return NextResponse.json({data:result,category,categoryLabel:activityCategoryLabel(category),accountMode:user.accountMode},{headers:{'Cache-Control':'private, no-store'}});
  }catch(error){
    return NextResponse.json({error:error instanceof Error&&error.message==='UNAUTHORIZED'?'Unauthorized':'Unable to load account activity.'},{status:error instanceof Error&&error.message==='UNAUTHORIZED'?401:503});
  }
}
