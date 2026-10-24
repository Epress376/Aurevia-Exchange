'use client';

import Image from 'next/image';

export default function AureviaStartup({isExiting}:{isExiting:boolean}){
	return <div className={`startup-screen${isExiting?' is-exiting':''}`} role="status" aria-live="polite" aria-label="Loading Aurevia Invest">
		<div className="startup-glow" aria-hidden="true"/>
		<div className="startup-card">
			<Image className="startup-logo" src="/aurevia-logo.png" alt="Aurevia Invest" width={128} height={128} priority/>
			<div className="startup-brand">AUREVIA <span>INVEST</span></div>
			<p>Restoring your workspace</p>
			<div className="startup-track" aria-hidden="true"><div className="startup-progress"/></div>
		</div>
	</div>;
}
