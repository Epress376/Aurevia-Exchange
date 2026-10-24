import {parsePhoneNumberFromString} from 'libphonenumber-js';
import type {CountryCode} from 'libphonenumber-js';

export function normalizePhoneE164(value:string,country:CountryCode){
	const parsed=parsePhoneNumberFromString(value,country);
	return parsed?.isValid()?parsed.number:null;
}

export function isValidE164(value:string){
	if(!/^\+[1-9]\d{1,14}$/.test(value))return false;
	const parsed=parsePhoneNumberFromString(value);
	return Boolean(parsed?.isValid()&&parsed.number===value);
}

export function parseDateOfBirth(value:string,now=new Date()){
	if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;
	const [year,month,day]=value.split('-').map(Number);
	const date=new Date(Date.UTC(year,month-1,day));
	if(date.getUTCFullYear()!==year||date.getUTCMonth()!==month-1||date.getUTCDate()!==day)return null;
	const today=Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate());
	return date.getTime()<=today?date:null;
}