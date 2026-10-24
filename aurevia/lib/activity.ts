import {AccountMode,InvestmentStatus,Prisma} from '@prisma/client';
import {db} from '@/lib/db';

export type ActivityCategory='all'|'trade'|'personal-trade'|'investment'|'deposit'|'withdrawal'|'order'|'position'|'account'|'security';

export type ActivityRecord={
  id:string;
  category:Exclude<ActivityCategory,'all'>;
  action:string;
  timestamp:string;
  asset:string;
  side?:'BUY'|'SELL';
  quantity:string;
  price:string|null;
  amount:string;
  status:string;
  source:'ledger'|'order'|'position'|'investment'|'funding'|'audit';
  sourceLabel:string;
  adminInitiated:boolean;
  pnl:string|null;
  link:string;
  details:Record<string,string|number|boolean|null>;
};

export type ActivityPage={items:ActivityRecord[];total:number;hasMore:boolean;cursor:string|null;};

const activityCategories=new Set<ActivityCategory>(['all','trade','personal-trade','investment','deposit','withdrawal','order','position','account','security']);
export function isActivityCategory(value:string):value is ActivityCategory{return activityCategories.has(value as ActivityCategory)}

function decimal(value:Prisma.Decimal|number|string|null|undefined){return value===null||value===undefined?new Prisma.Decimal(0):new Prisma.Decimal(value)}
function formatAmount(value:Prisma.Decimal|number|string){return decimal(value).toFixed(2)}
function formatNumber(value:Prisma.Decimal|number|string){return decimal(value).toString()}

export async function getUserActivity(userId:string,accountMode:AccountMode,category:ActivityCategory,limit=20):Promise<ActivityPage>{
  const [ledgerEntries,orders,positions,investments,fundingRequests,auditLogs]=await Promise.all([
    db.ledgerEntry.findMany({where:{account:{userId,accountMode}},include:{account:{select:{userId:true,currency:true,accountMode:true}},transaction:{select:{reference:true,description:true,createdAt:true}}},orderBy:{createdAt:'desc'},take:limit*3}),
    db.order.findMany({where:{userId,accountMode},include:{instrument:{select:{symbol:true}},executions:{select:{quantity:true,price:true,fee:true,createdAt:true}}},orderBy:{createdAt:'desc'},take:limit*3}),
    db.position.findMany({where:{userId,accountMode},include:{instrument:{select:{symbol:true}}},orderBy:{openedAt:'desc'},take:limit*3}),
    db.investmentRequest.findMany({where:{userId,accountMode},include:{opportunity:{select:{title:true,assetSymbol:true,category:true,targetReturnPercent:true,durationDays:true}}},orderBy:{requestedAt:'desc'},take:limit*3}),
    db.fundingRequest.findMany({where:{userId,accountMode},orderBy:{createdAt:'desc'},take:limit*3}),
    db.auditLog.findMany({where:{actorId:userId,entity:{in:['ORDER','POSITION','INVESTMENT']}},select:{id:true,actorId:true,action:true,entity:true,entityId:true,metadata:true,createdAt:true},orderBy:{createdAt:'desc'},take:limit*3}),
  ]);
  const records:ActivityRecord[] = [
    ...[...ledgerEntries.reduce((groups,entry)=>groups.set(entry.transactionId,[...(groups.get(entry.transactionId)||[]),entry]),new Map<string,typeof ledgerEntries>()).values()].map(entries=>{
      const entry=entries[0];
      if(!entry)throw new Error('LEDGER_TRANSACTION_EMPTY');
      const userEntries=entries.filter(item=>item.account.userId===userId);
      const conversion=entry.transaction.reference.startsWith('DEMO:BTC:CONVERSION:');
      const btcEntry=userEntries.find(item=>item.account.currency==='BTC');
      const usdEntry=userEntries.find(item=>item.account.currency==='USD');
      const mainEntry=conversion?(btcEntry||usdEntry||entry):usdEntry||userEntries[0]||entry;
      return {
        id:entry.transactionId,category:'account' as const,action:conversion?'SIMULATED BTC conversion':userEntries.some(item=>item.type==='CREDIT')?'Account ledger credit':'Account ledger debit',timestamp:entry.transaction.createdAt.toISOString(),asset:conversion?'BTC/USD':mainEntry.account.currency,quantity:formatNumber(mainEntry.amount),price:null,amount:formatAmount(mainEntry.amount),status:'POSTED',source:'ledger' as const,sourceLabel:entry.transaction.reference,adminInitiated:entry.transaction.reference.startsWith('ADMIN:'),pnl:null,link:'/activity',details:{reference:entry.transaction.reference,description:entry.transaction.description,accountMode:mainEntry.account.accountMode,currencies:[...new Set(userEntries.map(item=>item.account.currency))].join(', ')},
      };
    }),
    ...orders.map(order=>({
      id:order.id,category:(order.side==='BUY'?'trade':'personal-trade') as ActivityRecord['category'],action:`${order.side} ${order.type.toLowerCase()} order`,timestamp:order.createdAt.toISOString(),asset:order.instrument.symbol,side:order.side,quantity:formatNumber(order.quantity),price:order.averageFillPrice?formatAmount(order.averageFillPrice):order.price?formatAmount(order.price):null,amount:order.averageFillPrice?formatAmount(order.averageFillPrice!.mul(order.filledQuantity)):formatAmount(order.quantity),status:order.status.replaceAll('_',' '),source:'order' as const,sourceLabel:order.type,adminInitiated:false,pnl:null,link:`/orders`,details:{type:order.type,filledQuantity:formatNumber(order.filledQuantity),fee:formatAmount(order.fee)},
    })),
    ...positions.map(position=>({
      id:position.id,category:'position' as const,action:position.side==='BUY'?'Long position':'Short position',timestamp:position.openedAt.toISOString(),asset:position.instrument.symbol,side:position.side,quantity:formatNumber(position.quantity),price:formatAmount(position.entryPrice),amount:formatAmount(position.entryPrice.mul(position.quantity)),status:position.status,source:'position' as const,sourceLabel:'Open position',adminInitiated:false,pnl:position.realizedPnl?formatAmount(position.realizedPnl):null,link:'/portfolio',details:{averageEntry:formatAmount(position.entryPrice),margin:formatAmount(position.margin)},
    })),
    ...investments.map(investment=>({
      id:investment.id,category:'investment' as const,action:investment.opportunity.title,timestamp:investment.requestedAt.toISOString(),asset:investment.opportunity.assetSymbol||'INVESTMENT',quantity:formatNumber(investment.amount),price:null,amount:formatAmount(investment.amount),status:investment.status.replaceAll('_',' '),source:'investment' as const,sourceLabel:investment.opportunity.category,adminInitiated:false,pnl:investment.status===InvestmentStatus.SETTLED&&investment.simulatedPayout?formatAmount(decimal(investment.simulatedPayout).minus(decimal(investment.amount))):null,link:'/investments',details:{status:investment.status,targetReturnPercent:investment.targetReturnPercent?String(investment.targetReturnPercent):'Not stated',durationDays:investment.durationDays},
    })),
    ...fundingRequests.map(request=>({
      id:request.id,category:(request.type==='DEPOSIT'?'deposit':'withdrawal') as ActivityRecord['category'],action:request.type==='DEPOSIT'?'Funding deposit':'Funding withdrawal',timestamp:request.createdAt.toISOString(),asset:'USD',quantity:formatNumber(request.amount),price:null,amount:formatAmount(request.amount),status:request.status.replaceAll('_',' '),source:'funding' as const,sourceLabel:request.method,adminInitiated:false,pnl:null,link:`/wallet/transactions/${request.id}`,details:{type:request.type,method:request.method,reference:request.transactionReference||'Not set'},
    })),
  ];
  const auditByEntity=new Map<string,typeof auditLogs>();
  for(const audit of auditLogs){const key=`${audit.entity}:${audit.entityId}`;const existing=auditByEntity.get(key)||[];existing.push(audit);auditByEntity.set(key,existing)}
  for(const record of records){const audits=auditByEntity.get(`${record.source.toUpperCase()}:${record.id}`);if(audits?.some(audit=>audit.actorId!==userId))record.adminInitiated=true;}
  const filtered=records.filter(record=>category==='all'||record.category===category||record.category==='trade'&&category==='personal-trade'||record.category==='personal-trade'&&category==='trade');
  const sorted=filtered.sort((a,b)=>Date.parse(b.timestamp)-Date.parse(a.timestamp));
  const page=sorted.slice(0,limit);
  return {items:page,total:sorted.length,hasMore:sorted.length>limit,cursor:page.at(-1)?.id||null};
}

export function activityCategoryLabel(category:ActivityCategory){return ({all:'All activity',trade:'Trades', 'personal-trade':'Personal trades',investment:'Investments',deposit:'Deposits',withdrawal:'Withdrawals',order:'Orders',position:'Positions',account:'Account',security:'Security'} as const)[category]}
