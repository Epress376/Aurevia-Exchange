const endpoint=process.env.PUSH_DELIVERY_WORKER_URL;
const secret=process.env.PUSH_DELIVERY_CRON_SECRET;
const appUrl=process.env.NEXTAUTH_URL;
if(!endpoint||!secret||!appUrl){
	console.error('PUSH_DELIVERY_WORKER_URL, PUSH_DELIVERY_CRON_SECRET, and NEXTAUTH_URL are required.');
	process.exit(1);
}
let parsed,appOrigin;
try{parsed=new URL(endpoint);appOrigin=new URL(appUrl)}catch{
	console.error('PUSH_DELIVERY_WORKER_URL must be a valid HTTPS URL.');
	process.exit(1);
}
if(parsed.protocol!=='https:'||parsed.origin!==appOrigin.origin||parsed.username||parsed.password||parsed.search||parsed.hash||!parsed.pathname.endsWith('/api/cron/push-delivery')){
	console.error('PUSH_DELIVERY_WORKER_URL must be the same-origin HTTPS push-delivery endpoint.');
	process.exit(1);
}
try{
	const response=await fetch(parsed,{headers:{authorization:`Bearer ${secret}`},signal:AbortSignal.timeout(55_000)});
	if(!response.ok){
		console.error(`Push delivery worker returned HTTP ${response.status}.`);
		process.exit(1);
	}
	const result=await response.json();
	console.log(JSON.stringify(result));
}catch(error){
	console.error('Unable to reach the push delivery worker.',error instanceof Error?error.name:'UnknownError');
	process.exit(1);
}
