'use client';

import {useCallback,useEffect,useRef,useState} from 'react';
import type {ReactNode} from 'react';
import dynamic from 'next/dynamic';
import {useSession} from 'next-auth/react';
import AureviaStartup from '@/components/AureviaStartup';

const MarketDepthScene=dynamic(()=>import('@/components/MarketDepthScene'),{ssr:false});

const startupKey='aurevia-startup-complete';
const exitDurationMs=180;
const maximumStartupWaitMs=1200;

export default function StartupShell({children}:{children:ReactNode}){
	const {status}=useSession();
	const contentRef=useRef<HTMLDivElement>(null);
	const [ready,setReady]=useState(false);
	const [showStartup,setShowStartup]=useState(true);
	const [isExiting,setIsExiting]=useState(false);

	const markStartupComplete=useCallback(()=>{
		try{sessionStorage.setItem(startupKey,'1')}catch{}
		document.documentElement.dataset.aureviaStartupComplete='true';
		setShowStartup(false);
	},[]);

	useEffect(()=>{
		try{
			if(sessionStorage.getItem(startupKey)==='1'){
				document.documentElement.dataset.aureviaStartupComplete='true';
				setShowStartup(false);
			}
		}catch{}
		setReady(true);
	},[]);

	useEffect(()=>{
		contentRef.current?.toggleAttribute('inert',showStartup);
	},[showStartup]);

	useEffect(()=>{
		if(!ready||!showStartup)return;
		if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){
			markStartupComplete();
			return;
		}
		let exitTimer:number|undefined;
		const timer=window.setTimeout(()=>{
			setIsExiting(true);
			exitTimer=window.setTimeout(markStartupComplete,exitDurationMs);
		},status==='loading'?maximumStartupWaitMs:0);
		return()=>{
			window.clearTimeout(timer);
			if(exitTimer!==undefined)window.clearTimeout(exitTimer);
		};
	},[markStartupComplete,ready,showStartup,status]);

	return <div className="app-shell">
		<div className="scene-depth" aria-hidden="true"><MarketDepthScene/></div>
		<div className="scene-content"><div ref={contentRef} aria-hidden={showStartup}>{children}</div>{showStartup&&<AureviaStartup isExiting={isExiting}/>}</div>
	</div>;
}
