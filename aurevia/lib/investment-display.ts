export function calculateInvestmentDisplay(input:{
	principal:number;
	targetPayout:number;
	activatedAt:number;
	maturesAt:number;
	now:number;
}){
	const duration=input.maturesAt-input.activatedAt;
	const valid=Number.isFinite(input.principal)&&Number.isFinite(input.targetPayout)&&Number.isFinite(input.activatedAt)&&Number.isFinite(input.maturesAt)&&Number.isFinite(input.now)&&duration>0;
	if(!valid)return {progress:0,earnings:0,secondsRemaining:0,matured:false};
	const boundedNow=Math.min(input.maturesAt,Math.max(input.activatedAt,input.now));
	const progress=(boundedNow-input.activatedAt)/duration;
	return {
		progress,
		earnings:(input.targetPayout-input.principal)*progress,
		secondsRemaining:Math.max(0,Math.ceil((input.maturesAt-boundedNow)/1000)),
		matured:input.now>=input.maturesAt,
	};
}
