export type PublicResourceLink={id:string;title:string;url:string;description?:string};

export const PUBLIC_RESOURCE_LINKS_KEY='public_resource_links';

export function parsePublicResourceLinks(raw:string|null|undefined):PublicResourceLink[]{
	if(!raw?.trim())return [];
	try{
		const parsed=JSON.parse(raw) as unknown;
		if(!Array.isArray(parsed))return [];
		return parsed.filter((item):item is PublicResourceLink=>{
			if(!item||typeof item!=='object')return false;
			const row=item as Record<string,unknown>;
			return typeof row.id==='string'&&typeof row.title==='string'&&typeof row.url==='string'&&row.title.trim().length>0&&row.url.trim().length>0;
		}).map(item=>({
			id:item.id,
			title:item.title.trim().slice(0,120),
			url:item.url.trim().slice(0,500),
			...(typeof item.description==='string'&&item.description.trim()?{description:item.description.trim().slice(0,300)}:{}),
		}));
	}catch{
		return [];
	}
}

export function isSafePublicUrl(url:string){
	if(url.startsWith('/')&&!url.startsWith('//'))return true;
	try{
		const parsed=new URL(url);
		return parsed.protocol==='https:'||parsed.protocol==='http:';
	}catch{
		return false;
	}
}
