// Isolated browser. Never sends signup, sign-in or OTP requests; real guest routes are checked.
const { chromium, expect } = require('@playwright/test');
const assert = require('node:assert/strict');
const base = process.env.TEST_BASE_URL || 'http://localhost:3000';
(async () => {
  const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  let authMutations = 0;
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/auth/**', route => {
    if (route.request().method() === 'POST') { authMutations++; return route.abort(); }
    return route.continue();
  });
  try {
    for (const [path, method] of [['/api/history','GET'],['/api/history','POST'],['/api/history/00000000-0000-4000-8000-000000000000','GET'],['/api/history/00000000-0000-4000-8000-000000000000','DELETE']]) {
      const response = await context.request.fetch(base+path,{method});
      assert.equal(response.status(),401,`${method} ${path} must require a real session`);
      assert.match(response.headers()['cache-control'],/no-store/);
    }
    await page.goto(base+'/auth/sign-in',{waitUntil:'domcontentloaded'});
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]').first()).toBeVisible();
    await expect(page.getByRole('button', {name:'Войти',exact:true})).toBeVisible();
    await page.locator('button[type="submit"]').first().click();
    assert.equal(authMutations,0,'Empty form must not send authentication requests');
    await page.goto(base+'/auth/sign-up',{waitUntil:'domcontentloaded'});
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]').first()).toBeVisible();
    await page.evaluate(()=>localStorage.setItem('jarvis-locale','kk'));
    await page.goto(base+'/auth/sign-in',{waitUntil:'domcontentloaded'});
    await expect(page.getByRole('button', {name:'Кіру',exact:true})).toBeVisible();
    await page.goto(base,{waitUntil:'domcontentloaded'});
    await expect(page.locator('.account-history-trigger')).toBeEnabled({timeout:30000});
    await page.locator('.account-history-trigger').click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    assert.deepEqual(errors,[]);
    assert.equal(authMutations,0);
    console.log(JSON.stringify({ok:true,checks:['guest-history-GET-POST-DELETE-401','native-email-password-signin','native-signup-form','required-field-validation','ru-kk-auth-copy','lazy-account-dialog','escape-dismiss','no-runtime-errors'],emailsSent:0}));
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
