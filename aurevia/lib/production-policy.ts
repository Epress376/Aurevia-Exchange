import {AccountMode,Prisma,KycStatus} from '@prisma/client';

export type AccountTier='TIER 1'|'TIER 2'|'TIER 3';
export type TierContext={accountMode:AccountMode;kycStatus:KycStatus;verificationDocuments:number;verificationSubmitted?:boolean;approvedTier?:number;accountStatus?:string};
export type WithdrawalValidation={balance:string|number;pending:string|number;amount:string|number;withdrawalEnabled:boolean;accountRestricted?:boolean;kycStatus:KycStatus;hasCompletedInvestment?:boolean;simulated?:boolean};

const decimal=(value:string|number)=>new Prisma.Decimal(value.toString());

export function validateDepositApproval(requestedAmount:string|number,creditedAmount:string|number,feeAmount:string|number=0){
	const request=decimal(requestedAmount);
	const credit=decimal(creditedAmount);
	const fee=decimal(feeAmount);
	if(credit.lt(0)||fee.lt(0)||!credit.plus(fee).equals(request))throw new Error('DEPOSIT_AMOUNT_MISMATCH');
	return {requestedAmount:request.toString(),creditedAmount:credit.toString(),feeAmount:fee.toString()};
}

export function getAccountTier(context:TierContext):{label:AccountTier;progress:number;eligibleForRealTrading:boolean;verified:boolean}{
	const verified=context.accountMode===AccountMode.REAL&&context.verificationSubmitted===true&&context.kycStatus===KycStatus.APPROVED&&context.verificationDocuments>0;
	const evidenceTier=context.accountMode===AccountMode.REAL&&verified?3:context.accountMode===AccountMode.REAL&&(context.verificationSubmitted||context.kycStatus===KycStatus.APPROVED)?2:1;
	const level=Math.max(evidenceTier,Math.min(3,Math.max(1,context.approvedTier||1)));
	return {label:`TIER ${level}` as AccountTier,progress:level===3?100:level===2?75:context.accountMode===AccountMode.DEMO?60:25,eligibleForRealTrading:false,verified:level===3&&verified};
}

export function verifyKycState(status:KycStatus){return status===KycStatus.APPROVED;}
export function assertKycSubmissionAllowed(status:KycStatus){
	if(status===KycStatus.APPROVED)throw new Error('KYC_ALREADY_APPROVED');
}

export function validateTierUpgradeApproval(input:{requestCurrentTier:number;requestedTier:number;currentTier:number}){
	if(input.requestCurrentTier!==input.currentTier||input.requestedTier!==input.currentTier+1)throw new Error('TIER_REQUEST_STALE');
}

export function validateTierThreeApproval(input:{name:string|null;country:string|null;kycStatus:KycStatus;verificationSubmitted:boolean;approvedIdentityDocuments:number}){
	if(!input.name?.trim()||!input.country?.trim()||input.kycStatus!==KycStatus.APPROVED||!input.verificationSubmitted||input.approvedIdentityDocuments<1)throw new Error('TIER_3_REQUIREMENTS_NOT_MET');
}

export function validateWithdrawal(input:WithdrawalValidation){
	const balance=decimal(input.balance);const pending=decimal(input.pending);const amount=decimal(input.amount);
	if(!input.withdrawalEnabled)throw new Error('WITHDRAWAL_DISABLED');
	if(input.accountRestricted)throw new Error('ACCOUNT_RESTRICTED');
	if(!input.simulated&&input.hasCompletedInvestment===false)throw new Error('FIRST_TRADE_REQUIRED');
	if(amount.lte(0))throw new Error('INVALID_AMOUNT');
	if(balance.lt(amount.plus(pending)))throw new Error('INSUFFICIENT_BALANCE');
	if(!input.simulated&&input.kycStatus!==KycStatus.APPROVED)throw new Error('REAL_KYC_REQUIRED');
	return {balance:balance.toString(),pending:pending.toString(),amount:amount.toString()};
}
