import next from 'next';
import {createServer} from 'http';
import {Server as IOServer} from 'socket.io';
import {loadEnvConfig} from '@next/env';
import {randomBytes} from 'node:crypto';
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
	if(!dev){
		console.error('Missing required production configuration: NEXTAUTH_SECRET.');
		process.exit(1);
	}
	process.env.NEXTAUTH_SECRET=randomBytes(32).toString('hex');
}
if(!process.env.NEXTAUTH_URL){
	if(!dev){
		console.error('Missing required production configuration: NEXTAUTH_URL.');
		process.exit(1);
	}
	process.env.NEXTAUTH_URL=`http://localhost:${port}`;
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
    for(const [name,value] of [['NEXTAUTH_URL',process.env.NEXTAUTH_URL],['NEXT_PUBLIC_APP_URL',configuredPublicUrl]] as const){
      if(!value)continue;
      try{
        const parsed=new URL(value);
        const isLocalTestHttp=parsed.protocol==='http:'&&['localhost','127.0.0.1','::1'].includes(parsed.hostname)&&process.env.AUREVIA_E2E_ALLOW_HTTP_PROVIDER==='1';
        if(parsed.protocol!=='https:'&&!isLocalTestHttp)throw new Error('HTTPS_REQUIRED');
      }catch{
        console.error(`${name} must be a valid absolute HTTPS URL in production.`);
        process.exit(1);
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
    console.log(`Aurevia Exchange HTTP server listening on 0.0.0.0:${port}`);
    void prepareApplication();
  });
}

void startServer();
