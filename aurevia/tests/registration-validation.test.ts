import {describe,expect,it} from 'vitest';
import {supportedCountries,countrySearchMatches,findCountry} from '../lib/countries';
import {isValidE164,normalizePhoneE164,parseDateOfBirth} from '../lib/registration-validation';

describe('registration country and phone validation',()=>{
	it('puts the United States first and sorts the rest alphabetically',()=>{
		expect(supportedCountries[0]).toMatchObject({code:'US',name:'United States',dialCode:'+1'});
		expect(supportedCountries.slice(1).map(country=>country.name)).toEqual([...supportedCountries.slice(1).map(country=>country.name)].sort((a,b)=>a.localeCompare(b,'en')));
		expect(supportedCountries.length).toBeGreaterThan(200);
	});

	it('searches by country name, ISO code, and calling code',()=>{
		expect(countrySearchMatches(findCountry('NG')!,'Nigeria')).toBe(true);
		expect(countrySearchMatches(findCountry('NG')!,'ng')).toBe(true);
		expect(countrySearchMatches(findCountry('NG')!,'+234')).toBe(true);
		expect(findCountry('GB')).toMatchObject({name:'United Kingdom',dialCode:'+44'});
	});

	it('normalizes national numbers to valid E.164 values',()=>{
		expect(normalizePhoneE164('(202) 555-0123','US')).toBe('+12025550123');
		expect(normalizePhoneE164('07400 123456','GB')).toBe('+447400123456');
		expect(normalizePhoneE164('0803 123 4567','NG')).toBe('+2348031234567');
		expect(isValidE164('+2348031234567')).toBe(true);
		expect(isValidE164('0803 123 4567')).toBe(false);
		expect(normalizePhoneE164('123','US')).toBeNull();
	});
});

describe('registration date of birth validation',()=>{
	const now=new Date('2026-10-04T12:00:00Z');
	it('accepts exact calendar dates and rejects future or impossible dates',()=>{
		expect(parseDateOfBirth('2000-02-29',now)?.toISOString()).toBe('2000-02-29T00:00:00.000Z');
		expect(parseDateOfBirth('2026-10-05',now)).toBeNull();
		expect(parseDateOfBirth('2026-02-29',now)).toBeNull();
		expect(parseDateOfBirth('10/04/2000',now)).toBeNull();
	});
});