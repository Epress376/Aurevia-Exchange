import next from 'next';
import {createServer} from 'http';
import {Server as IOServer} from 'socket.io';
import {loadEnvConfig} from '@next/env';
import {tickMarkets} from './lib/market';
import {settleMaturedSimulatedInvestments} from './lib/demo-investment-settlement';
import {resolveRenderApplicationUrls} from './lib/config/render-urls';

loadEnvConfig(process.cwd());
const renderApplicationUrls=resolveRenderApplicationUrls(process.env);
if(renderApplicationUrls){
	process.env.NEXTAUTH_URL=renderApplicationUrls.nextAuthUrl;
	process.env.NEXT_PUBLIC_APP_URL=renderApplicationUrls.publicAppUrl;
}
const dev=process.env.NODE_ENV!=='production';
const port=Number(process.env.PORT||3000);
if(!process.env.NEXTAUTH_SECRET){
	console.warn('NEXTAUTH_SECRET is not configured; generating an ephemeral fallback secret for this process. Set it in Render for stable sessions.');
	process.env.NEXTAUTH_SECRET='aurevia-ephemeral-secret-change-me';
}
if(!process.env.NEXTAUTH_URL){
	process.env.NEXTAUTH_URL=`http://localhost:${port}`;
	console.warn('NEXTAUTH_URL is not configured; defaulting to localhost for this process. Set it to the production URL in Render.');
}
if(!process.env.NEXT_PUBLIC_APP_URL){
	process.env.NEXT_PUBLIC_APP_URL=process.env.NEXTAUTH_URL;
}
const app=next({dev});
const handle=app.getRequestHandler();
const configuredPublicUrl=process.env.NEXT_PUBLIC_APP_URL||process.env.NEXTAUTH_URL;
const publicUrl=configuredPublicUrl||`http://localhost:${port}`;

function safeErrorCode(error:unknown){
 const value=error&&typeof error==='object'&&'code' in error?String(error.code):'';
 return /^[A-Z0-9_]{2,32}$/.test(value)?value:error instanceof Error?error.name:'UnknownError';
}

async function startServer(){
  if(!dev){
    const missing=['NEXTAUTH_SECRET','NEXTAUTH_URL'].filter(name=>!process.env[name]?.trim());
    if(missing.length){
      console.warn(`Missing production configuration: ${missing.join(', ')}. Falling back to safe runtime defaults for this process.`);
    }
    for(const [name,value] of [['NEXTAUTH_URL',process.env.NEXTAUTH_URL],['NEXT_PUBLIC_APP_URL',configuredPublicUrl]] as const){
      if(!value)continue;
      try{new URL(value)}catch{
        console.warn(`${name} is not a valid absolute URL; continuing with the fallback runtime value: ${value}`);
      }
    }
  }

  let appReady=false;
  const http=createServer((req,res)=>{
    if(!appReady){
      res.writeHead(503,{'Retry-After':'1'}).end('Service starting');
      return;
    }
    handle(req,res);
  });
  const io=new IOServer(http,{cors:{origin:publicUrl,credentials:true}});
  io.on('connection',socket=>{socket.emit('connected',{ok:true});});
  const intervalMs=Math.max(1000,Number(process.env.MARKET_TICK_MS||2500));
  let running=false;
  let consecutiveFailures=0;

  function scheduleNextTick(delay:number){setTimeout(()=>{void runMarketTick()},delay)}
  const runMarketTick=async()=>{
    if(running)return scheduleNextTick(intervalMs);
    running=true;
    let nextDelay=intervalMs;
    try{
      const data=await tickMarkets();
      consecutiveFailures=0;
      io.emit('market:update',data);
      try{
        const maturedInvestmentsSettled=await settleMaturedSimulatedInvestments();
        if(maturedInvestmentsSettled)console.log(`Auto-settled ${maturedInvestmentsSettled} matured simulated investment(s).`);
      }catch(settlementError){
        console.error(`Scheduled simulated investment settlement failed (${safeErrorCode(settlementError)}).`);
      }
    }catch(error){
      consecutiveFailures++;
      nextDelay=Math.min(intervalMs*2**Math.min(consecutiveFailures,6),60_000);
      console.error(`Market tick failed; retrying in ${nextDelay}ms (attempt ${consecutiveFailures}, ${safeErrorCode(error)}).`);
    }finally{
      running=false;
      scheduleNextTick(nextDelay);
    }
  };
  async function prepareApplication(){
    try{
      await app.prepare();
      appReady=true;
      console.log('Next.js application ready');
      scheduleNextTick(0);
    }catch(error){
      console.error('Next.js preparation failed; startup aborted',error);
      process.exit(1);
    }
  }

  http.once('error',(error:NodeJS.ErrnoException)=>{
    console.error(error.code==='EADDRINUSE'?'Configured HTTP port is already in use':'HTTP server failed to start');
    process.exit(1);
  });

  http.listen(port,'0.0.0.0',()=>{
    console.log(`Aurevia Invest HTTP server listening on 0.0.0.0:${port}`);
    void prepareApplication();
  });
}

void startServer();
