import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AUTH_BODY_LIMIT, AuthPolicyError, authPath, guardAuthOwner, guardAuthTarget, isDemoEmail, protectAuthOrigin, readAuthBody, requiresDemoSessionCheck } from '../src/lib/auth-policy';

const request = (body?: string, headers: Record<string,string> = {}) => new Request('https://jarvis.example/api/auth/sign-in/email', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body });
const blocked = (call: () => void, code: string) => assert.throws(call, error => error instanceof AuthPolicyError && error.code === code);

test('demo address cannot request reset/verification or register, including case and whitespace', () => {
  assert.equal(isDemoEmail(' Demo@Jarvis-Ekt.Example '), true);
  for (const path of ['sign-up/email','request-password-reset','reset-password','email-otp/send-verification-otp','email-otp/passcode','send-verification-email']) blocked(() => guardAuthTarget(path,{email:' Demo@Jarvis-Ekt.Example '}),'DEMO_ACCOUNT_READ_ONLY');
  guardAuthTarget('sign-in/email',{email:'demo@jarvis-ekt.example'});
  guardAuthTarget('sign-out'); guardAuthTarget('get-session');
});
test('regular signup/email verification/password reset stay enabled, passwordless local login disabled', () => {
  for (const path of ['sign-up/email','request-password-reset','reset-password','email-otp/send-verification-otp','email-otp/verify-email','email-otp/passcode']) guardAuthTarget(path,{email:'member@example.invalid',type:'email-verification'});
  guardAuthTarget('email-otp/send-verification-otp',{email:'member@example.invalid',type:'forget-password'});
  for (const path of ['sign-in/email-otp','sign-in/magic-link','magic-link/verify']) blocked(() => guardAuthTarget(path),'PASSWORD_SIGN_IN_REQUIRED');
  blocked(() => guardAuthTarget('email-otp/send-verification-otp',{email:'member@example.invalid',type:'sign-in'}),'PASSWORD_SIGN_IN_REQUIRED');
});
test('trusted demo session blocks profile, credentials, deletion and account linking, not normal users', () => {
  for (const path of ['change-password','set-password','update-user','delete-user','delete-user/callback','change-email','link-account','link-social','unlink-account','reset-password','email-otp/passcode']) {
    assert.equal(requiresDemoSessionCheck(path),true);
    blocked(() => guardAuthOwner(path,{email:'demo@jarvis-ekt.example'}),'DEMO_ACCOUNT_READ_ONLY');
    guardAuthOwner(path,{email:'member@example.invalid'});
  }
  assert.equal(requiresDemoSessionCheck('sign-in/email'),false);
  // Body email/id is not an owner identity: the route obtains owner from getSession.
  guardAuthTarget('change-password',{email:'member@example.invalid',userId:'forged'});
  blocked(() => guardAuthOwner('change-password',{email:'demo@jarvis-ekt.example'}),'DEMO_ACCOUNT_READ_ONLY');
});
test('origin checks reject cross-site, null and mismatched protocol while allowing normal same-origin requests', () => {
  protectAuthOrigin(request('{}',{Origin:'https://jarvis.example'})); protectAuthOrigin(request('{}'));
  const badHeaders: Record<string,string>[] = [{Origin:'https://attacker.example'},{Origin:'null'},{Origin:'http://jarvis.example'},{'sec-fetch-site':'cross-site'}];
  for (const headers of badHeaders) blocked(()=>protectAuthOrigin(request('{}',headers)),'INVALID_ORIGIN');
  protectAuthOrigin(new Request('http://0.0.0.0:3000/api/auth/sign-in/email',{headers:{Host:'localhost:3000',Origin:'http://localhost:3000'}}));
});
test('body read uses clone, enforces actual UTF8 bytes without content-length and rejects malformed JSON', async () => {
  const original=request('{"email":"member@example.invalid"}');
  assert.deepEqual(await readAuthBody(original),{email:'member@example.invalid'});
  assert.equal(await original.text(),'{"email":"member@example.invalid"}');
  await assert.rejects(readAuthBody(request(' '.repeat(AUTH_BODY_LIMIT+1))),error=>error instanceof AuthPolicyError&&error.status===413);
  await assert.rejects(readAuthBody(request(JSON.stringify({name:'ә'.repeat(AUTH_BODY_LIMIT/2)}))),error=>error instanceof AuthPolicyError&&error.status===413);
  await assert.rejects(readAuthBody(request('{}',{'content-length':String(AUTH_BODY_LIMIT+1)})),error=>error instanceof AuthPolicyError&&error.status===413);
  for(const input of ['{','[]','null','"text"']) await assert.rejects(readAuthBody(request(input)),error=>error instanceof AuthPolicyError&&error.status===400);
  await assert.rejects(readAuthBody(request('email=demo%40jarvis-ekt.example',{'Content-Type':'application/x-www-form-urlencoded'})),error=>error instanceof AuthPolicyError&&error.status===415);
  assert.deepEqual(await readAuthBody(request()),{});
});
test('path matching rejects encoded separator ambiguity',()=>{
  assert.equal(authPath(['email-otp','send-verification-otp']),'email-otp/send-verification-otp');
  assert.equal(authPath(['reset-password','normal_reset-token.123']),'reset-password/normal_reset-token.123');
  for(const parts of [['change-password/extra'],['%63hange-password'],['..'],[]]) blocked(()=>authPath(parts),'INVALID_AUTH_PATH');
});
