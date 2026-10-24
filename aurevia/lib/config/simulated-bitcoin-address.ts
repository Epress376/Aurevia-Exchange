export const SIMULATED_BTC_ADDRESS_SETTING='SIMULATED_BTC_DEPOSIT_ADDRESS';

const base58Address=/^[13][1-9A-HJ-NP-Za-km-z]{25,34}$/;
const bech32Address=/^bc1[ac-hj-np-z02-9]{11,87}$/;

export function isBitcoinMainnetAddress(value:string){
	if(value!==value.trim()||value.length<14||value.length>90)return false;
	if(base58Address.test(value))return true;
	if(value!==value.toLowerCase()&&value!==value.toUpperCase())return false;
	return bech32Address.test(value.toLowerCase());
}
