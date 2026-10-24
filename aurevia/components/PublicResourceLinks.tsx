'use client';

import {useEffect,useState} from 'react';
import Link from 'next/link';
import {ArrowUpRight,ExternalLink} from 'lucide-react';

type LinkRow={id:string;title:string;url:string;description?:string};

export default function PublicResourceLinks(){
	const [links,setLinks]=useState<LinkRow[]>([]);

	useEffect(()=>{
		let active=true;
		void fetch('/api/public-links',{cache:'no-store'}).then(async response=>{
			const result=await response.json();
			if(!active||!response.ok)return;
			setLinks(Array.isArray(result.links)?result.links:[]);
		}).catch(()=>{});
		return ()=>{active=false};
	},[]);

	if(!links.length)return null;

	return (
		<section className="home-section public-resource-links" aria-label="Resource links">
			<div className="section-heading">
				<div>
					<p className="eyebrow">RESOURCES</p>
					<h2>Explore more</h2>
				</div>
			</div>
			<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
				{links.map(link=>{
					const internal=link.url.startsWith('/');
					const className='card public-resource-link p-4 flex flex-col gap-2 min-h-[96px]';
					const body=(
						<>
							<span className="font-semibold text-[#f4f7f5] flex items-center gap-2">{link.title}{internal?<ArrowUpRight size={14}/>:<ExternalLink size={14}/>}</span>
							{link.description&&<span className="text-sm muted">{link.description}</span>}
						</>
					);
					return internal?(
						<Link key={link.id} href={link.url} className={className}>{body}</Link>
					):(
						<a key={link.id} href={link.url} className={className} target="_blank" rel="noopener noreferrer">{body}</a>
					);
				})}
			</div>
			<div className="mt-4">
				<Link href="/" className="text-link">Return to Aurevia home</Link>
			</div>
		</section>
	);
}
