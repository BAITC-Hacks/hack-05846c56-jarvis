import assert from 'node:assert/strict';
import {test} from 'node:test';
import {authErrorMessage} from '../src/lib/auth-errors';

test('Neon normalized thrown errors and raw Better Auth errors remain localized',()=>{
 assert.match(authErrorMessage({code:'email_not_confirmed'},'ru'),/Подтвердите email/);
 assert.match(authErrorMessage({code:'EMAIL_NOT_VERIFIED'},'kk'),/растаңыз/);
 assert.match(authErrorMessage({code:'invalid_credentials'},'ru'),/восстановить пароль/);
 assert.match(authErrorMessage({code:'validation_failed'},'ru',true),/Код неверный/);
 assert.match(authErrorMessage({code:'over_request_rate_limit',status:429},'kk'),/Бір минут/);
});
test('unknown provider diagnostics never leak into user-facing errors',()=>{
 const message=authErrorMessage({code:'upstream-internal-private-diagnostic'},'ru');
 assert.ok(!message.includes('upstream'));
 assert.match(message,/попробуйте ещё раз/);
});
