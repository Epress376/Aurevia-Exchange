import type {ReactNode} from 'react';
import {cookies} from 'next/headers';
import Script from 'next/script';
import './globals.css';
import './experience.css';
import StartupShell from '@/components/StartupShell';
import Providers from '@/components/Providers';
import {normalizeLocale} from '@/lib/i18n';

export const metadata={title:'Aurevia Exchange',description:'Aurevia Exchange — a secure, account-first digital markets platform'};
export const viewport={width:'device-width',initialScale:1,viewportFit:'cover',themeColor:'#0B0F1A'};

export default async function RootLayout({children}:{children:ReactNode}){
  const cookieStore=await cookies();
  const initialLocale=normalizeLocale(cookieStore.get('aurevia-locale')?.value ?? null);
  const direction=initialLocale==='ar'?'rtl':'ltr';
  return <html lang={initialLocale} dir={direction} suppressHydrationWarning><body><Script id="aurevia-startup-state" strategy="beforeInteractive">{`try{if(sessionStorage.getItem('aurevia-startup-complete')==='1')document.documentElement.dataset.aureviaStartupComplete='true'}catch{}`}</Script><Providers initialLocale={initialLocale}><StartupShell>{children}</StartupShell></Providers></body></html>;
}
