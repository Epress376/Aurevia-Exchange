import {getCountries,getCountryCallingCode} from 'libphonenumber-js';
import type {CountryCode} from 'libphonenumber-js';

export type SupportedCountry={code:CountryCode;name:string;dialCode:string;flag:string};

function flagFor(code:string){
	return [...code.toUpperCase()].map(character=>String.fromCodePoint(character.charCodeAt(0)+127397)).join('');
}

const regionNames=new Intl.DisplayNames(['en'],{type:'region'});

export const supportedCountries:SupportedCountry[]=getCountries().map(code=>({
	code,
	name:regionNames.of(code)||code,
	dialCode:`+${getCountryCallingCode(code)}`,
	flag:flagFor(code),
})).sort((left,right)=>left.code==='US'?-1:right.code==='US'?1:left.name.localeCompare(right.name,'en'));

export function findCountry(value:string){
	return supportedCountries.find(country=>country.code===value)||null;
}

export function countrySearchMatches(country:SupportedCountry,query:string){
	const search=query.trim().toLocaleLowerCase();
	if(!search)return true;
	const dialSearch=search.replace(/[\s()-]/g,'');
	return country.name.toLocaleLowerCase().includes(search)||country.code.toLocaleLowerCase().includes(search)||country.dialCode.includes(dialSearch);
}