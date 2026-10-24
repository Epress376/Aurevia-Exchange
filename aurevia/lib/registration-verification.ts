export function requiresRegistrationVerification(
  role:'USER'|'ADMIN',
  verificationEnabled:boolean,
  userRequiresVerification:boolean,
  verifiedAt:Date|null,
){
  return role==='USER'&&verificationEnabled&&userRequiresVerification&&!verifiedAt;
}
