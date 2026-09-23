// Explicit live test of the public demo account. Only the uniquely named record created here is deleted.
// Auth + history are real. The assistant reply is mocked to avoid model charges. No email is sent.
const {chromium,expect}=require('@playwright/test');
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const base=process.env.TEST_BASE_URL||'http://localhost:3000';
(async()=>{
 const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true});
 const context=await browser.newContext({viewport:{width:1280,height:900}}),page=await context.newPage();
 const title='QA demo history '+randomUUID(),reply='Synthetic history verification. Safe to delete.';
 let createdId=null;
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/api/chat',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({message:reply,products:[],suggestions:[],sources:[],mode:'catalog'})}));
 try{
   await page.goto(base+'/auth/sign-in');
   await page.getByRole('button',{name:'Заполнить демо-данные',exact:true}).click();
   await expect(page.locator('input[name=email]')).toHaveValue('user1');
   const signin=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/auth/sign-in/email');
   await page.getByRole('button',{name:'Войти',exact:true}).click();
   assert.equal((await signin).status(),200);
   await expect(page).toHaveURL(base+'/');
   await expect(page.locator('.account-history-trigger')).toHaveAttribute('aria-label','Аккаунт и история',{timeout:30000});
   await page.getByRole('textbox').first().fill(title);
   await page.getByRole('button',{name:'Отправить',exact:true}).click();
   await expect(page.locator('.message-assistant')).toContainText(reply);
   await page.locator('.account-history-trigger').click();
   await expect(page.getByText(/Общий демо-аккаунт:/)).toBeVisible();
   await page.screenshot({path:require('node:path').join(require('node:os').tmpdir(),'jarvis-auth-demo-live.png')});
   const saved=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/history'&&r.request().method()==='POST');
   await page.getByRole('button',{name:'Сохранить диалог',exact:true}).click();
   const savedResponse=await saved;const savedBody=await savedResponse.json();assert.equal(savedResponse.status(),201,JSON.stringify(savedBody));createdId=savedBody.conversation.id;
   await expect(page.locator('.account-history-list strong').filter({hasText:title})).toBeVisible();
   await page.reload();
   await expect(page.locator('.account-history-trigger')).toHaveAttribute('aria-label','Аккаунт и история',{timeout:30000});
   await page.locator('.account-history-trigger').click();
   await page.getByRole('button',{name:'Новый',exact:true}).click();
   await expect(page.locator('.message-user')).toHaveCount(0);
   await page.locator('.account-history-trigger').click();
   await page.locator('.account-history-list article').filter({hasText:title}).locator('button').first().click();
   await expect(page.getByRole('dialog')).toHaveCount(0);
   await expect(page.locator('.message-user')).toContainText(title);
   await expect(page.locator('.message-assistant')).toContainText(reply);
   await page.locator('.account-history-trigger').click();
   await page.getByRole('button',{name:'Удалить: '+title,exact:true}).click();
   const deleted=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/history/'+createdId&&r.request().method()==='DELETE');
   await page.getByRole('button',{name:'Удалить',exact:true}).click();
   assert.equal((await deleted).status(),200);createdId=null;
   await expect(page.locator('.account-history-list strong').filter({hasText:title})).toHaveCount(0);
   await page.getByRole('button',{name:'Выйти',exact:true}).click();
   await expect(page.locator('.account-history-trigger')).toHaveAttribute('aria-label','Войти');
   assert.equal((await context.request.get(base+'/api/history')).status(),401);
   assert.deepEqual(errors,[]);
   console.log(JSON.stringify({ok:true,liveAuth:true,liveDatabase:true,assistantMocked:true,checks:['demo-alias-password-login','shared-account-warning','explicit-save','reload-new-chat-restore','delete-own-test-record','logout-guest-401'],syntheticRecordsRemaining:0,emailsSent:0}));
 }finally{
   if(createdId){const cleanup=await context.request.delete(base+'/api/history/'+createdId);if(!cleanup.ok())throw new Error('Cleanup of own synthetic record failed');}
   await browser.close();
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
