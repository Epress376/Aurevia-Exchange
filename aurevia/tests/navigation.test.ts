import {describe,expect,it} from 'vitest';
import {safeInternalPath} from '@/lib/navigation';

describe('safe post-authentication navigation',()=>{
	it('preserves local destinations including query strings and hashes',()=>{
		expect(safeInternalPath('/wallet/transactions?filter=pending#latest')).toBe('/wallet/transactions?filter=pending#latest');
	});

	it('rejects external, protocol-relative and malformed destinations',()=>{
		expect(safeInternalPath('https://attacker.test')).toBe('/dashboard');
		expect(safeInternalPath('//attacker.test')).toBe('/dashboard');
		expect(safeInternalPath('/\\\\attacker.test')).toBe('/dashboard');
	});
});
