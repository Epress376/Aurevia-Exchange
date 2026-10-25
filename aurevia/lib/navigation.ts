export function safeInternalPath(value:string,fallback='/dashboard'){
	if(!value.startsWith('/')||value.startsWith('//')||value.includes('\\'))return fallback;
	try{
		const url=new URL(value,'https://aurevia.invalid');
		if(url.origin!=='https://aurevia.invalid')return fallback;
		return `${url.pathname}${url.search}${url.hash}`;
	}catch{return fallback}
}
