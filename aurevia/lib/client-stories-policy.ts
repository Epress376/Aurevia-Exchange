type WithdrawalCandidate={userId:string;type:string;accountMode:string;status:string;settlementReference:string|null;settledAt:Date|null};

export function isVerifiedClientWithdrawal(withdrawal:WithdrawalCandidate|null,userId:string|null){
	return Boolean(withdrawal&&userId&&withdrawal.userId===userId&&withdrawal.type==='WITHDRAWAL'&&withdrawal.accountMode==='REAL'&&withdrawal.status==='COMPLETED'&&withdrawal.settlementReference&&!withdrawal.settlementReference.startsWith('SIMULATED-')&&withdrawal.settledAt);
}

/** Published client stories require a linked, verified client, verified transaction, and confirmed consent. */
export function canPublishClientStory(input:{userId:string|null;verifiedClient:boolean;transactionVerified:boolean;consentConfirmed:boolean}){
	return Boolean(input.userId&&input.verifiedClient&&input.transactionVerified&&input.consentConfirmed);
}

export function publicWithdrawalAmount(input:{show:boolean;displayCurrency:string|null;currency:string;amount:string;amountMatches:boolean}){
	if(!input.show||!input.amountMatches||input.displayCurrency!==input.currency)return null;
	return {amount:input.amount,currency:input.currency};
}
