import {describe,expect,it} from 'vitest';
import {calculateInvestmentDisplay} from '@/lib/investment-display';

describe('display-only investment progress',()=>{
	const start=Date.parse('2026-01-01T00:00:00.000Z');
	const end=Date.parse('2026-01-11T00:00:00.000Z');

	it('interpolates earnings and remaining duration using the clamped clock',()=>{
		expect(calculateInvestmentDisplay({principal:100,targetPayout:120,activatedAt:start,maturesAt:end,now:start+5*86_400_000})).toEqual({
			progress:0.5,earnings:10,secondsRemaining:432000,matured:false,
		});
	});

	it('clamps pre-start time to zero progress and zero earnings',()=>{
		const result=calculateInvestmentDisplay({principal:100,targetPayout:120,activatedAt:start,maturesAt:end,now:start-1000});
		expect(result).toMatchObject({progress:0,earnings:0,secondsRemaining:864000,matured:false});
	});

	it('stops at maturity without exceeding the target earnings',()=>{
		const result=calculateInvestmentDisplay({principal:100,targetPayout:120,activatedAt:start,maturesAt:end,now:end+60_000});
		expect(result).toMatchObject({progress:1,earnings:20,secondsRemaining:0,matured:true});
	});

	it('does not show negative accrued earnings when recorded payout is below principal',()=>{
		const result=calculateInvestmentDisplay({principal:100,targetPayout:90,activatedAt:start,maturesAt:end,now:start+5*86_400_000});
		expect(result.earnings).toBe(0);
	});

	it('returns safe zero values for invalid investment terms',()=>{
		expect(calculateInvestmentDisplay({principal:100,targetPayout:120,activatedAt:start,maturesAt:start,now:start})).toEqual({
			progress:0,earnings:0,secondsRemaining:0,matured:false,
		});
	});
});
