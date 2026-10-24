import {afterEach,describe,expect,it} from 'vitest';
import {availableVerificationChannel,generateVerificationCode,hashVerificationCode,registrationVerificationChannel,verificationCodeMatches} from '../lib/verification-delivery';

describe('account verification codes',()=>{
 const previousSecret=process.env.VERIFICATION_CODE_SECRET;
 const deliveryKeys=['VERIFICATION_EMAIL_API_URL','VERIFICATION_EMAIL_API_KEY','VERIFICATION_SMS_API_URL','VERIFICATION_SMS_API_KEY','REGISTRATION_VERIFICATION_ENABLED','AUREVIA_E2E_ALLOW_HTTP_PROVIDER'];
 const previousDeliveryValues=Object.fromEntries(deliveryKeys.map(key=>[key,process.env[key]]));
 afterEach(()=>{
  if(previousSecret===undefined)delete process.env.VERIFICATION_CODE_SECRET;
  else process.env.VERIFICATION_CODE_SECRET=previousSecret;
  for(const key of deliveryKeys){const value=previousDeliveryValues[key];if(value===undefined)delete process.env[key];else process.env[key]=value}
 });

 it('generates six-digit codes and verifies only the matching account-bound code',()=>{
  process.env.VERIFICATION_CODE_SECRET='unit-test-only-secret';
  const userId='verification-test-user';
  const code=generateVerificationCode();
  const hash=hashVerificationCode(userId,code);

  expect(code).toMatch(/^\d{6}$/);
  expect(hash).not.toContain(code);
  expect(verificationCodeMatches(userId,code,hash)).toBe(true);
  expect(verificationCodeMatches('another-user',code,hash)).toBe(false);
  expect(verificationCodeMatches(userId,'000000',hash)).toBe(code==='000000');
 });

 it('requires HTTPS except for an explicitly enabled loopback E2E provider',()=>{
  process.env.VERIFICATION_EMAIL_API_KEY='test-only-key';
  process.env.VERIFICATION_EMAIL_API_URL='http://mail.example.invalid/send';
  expect(availableVerificationChannel(null)).toBeNull();
  process.env.VERIFICATION_EMAIL_API_URL='https://mail.example.invalid/send';
  expect(availableVerificationChannel(null)).toBe('EMAIL');
  process.env.VERIFICATION_EMAIL_API_URL='http://127.0.0.1:4311/email';
  expect(availableVerificationChannel(null)).toBeNull();
  process.env.AUREVIA_E2E_ALLOW_HTTP_PROVIDER='1';
  expect(availableVerificationChannel(null)).toBe('EMAIL');
  process.env.VERIFICATION_EMAIL_API_URL='https://user:password@mail.example.invalid/send';
  expect(availableVerificationChannel(null)).toBeNull();
 });

    it('selects verification channels only when explicitly requested by a caller',()=>{
        process.env.REGISTRATION_VERIFICATION_ENABLED='false';
        process.env.VERIFICATION_SMS_API_KEY='test-only-key';
        process.env.VERIFICATION_SMS_API_URL='https://sms.example.invalid/send';
           expect(registrationVerificationChannel('+12125550123',true,false)).toBeNull();
        process.env.REGISTRATION_VERIFICATION_ENABLED='true';
           expect(registrationVerificationChannel('+12125550123',true,true)).toBe('SMS');
           expect(registrationVerificationChannel(null,true,true)).toBeNull();
        process.env.VERIFICATION_EMAIL_API_KEY='test-only-key';
        process.env.VERIFICATION_EMAIL_API_URL='https://mail.example.invalid/send';
           expect(registrationVerificationChannel('+12125550123',false,true)).toBe('EMAIL');
    });
});
