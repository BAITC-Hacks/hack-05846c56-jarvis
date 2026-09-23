// Optional LIVE public-demo check. Auth/history real; only assistant response mocked. No mail.
// Creates exactly two uniquely labelled records and deletes only those records, including on failure.
const {chromium,expect:baseExpect}=require('@playwright/test');
const expect=baseExpect.configure({timeout:30000});
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const base=process.env.TEST_BASE_URL||'http://localhost:3000';
(async()=>{
 const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||undefined,headless:true});
 const context=await browser.newContext({viewport:{width:1280,height:900}}),page=await context.newPage();page.setDefaultTimeout(30000);
 const label='QA demo '+randomUUID(),a=label+' A',b=label+' B',reply='Synthetic history verification. Safe to delete.',created=new Set(),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/api/chat',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({message:reply,products:[],suggestions:[],sources:[],mode:'catalog'})}));
 const send=async text=>{await page.getByRole('textbox').first().fill(text);await page.getByRole('button',{name:'Отправить',exact:true}).click();await expect(page.locator('.message-assistant')).toContainText(reply);};
 const history=()=>page.locator('.account-history-trigger').click();
 const createResponse=()=>page.waitForResponse(r=>new URL(r.url()).pathname==='/api/history'&&r.request().method()==='POST'&&r.status()===201);
 const track=async pending=>{const response=await pending;const body=await response.json();assert.ok(body.conversation.title.startsWith(label));created.add(body.conversation.id);return body.conversation.id;};
 try{
   await page.goto(base+'/auth/sign-in');await page.getByRole('button',{name:'Заполнить демо-данные',exact:true}).click();
   await expect(page.locator('input[name=email]')).toHaveValue('user1');
   const signin=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/auth/sign-in/email');
   await page.getByRole('button',{name:'Войти',exact:true}).click();assert.equal((await signin).status(),200);
   await expect(page).toHaveURL(base+'/');await expect(page.locator('.account-history-trigger')).toHaveAttribute('aria-label','Аккаунт и история');
   await send(a);const savedA=createResponse();
   await page.locator('.conversation-actions').getByRole('button',{name:'Новый диалог',exact:true}).click();
   const idA=await track(savedA);await expect(page.locator('.message')).toHaveCount(0);
   await send(b);await history();await expect(page.getByText(/Общий демо-аккаунт:/)).toBeVisible();
   const savedB=createResponse();await page.locator('.account-history-list article').filter({hasText:a}).locator('button').first().click();
   const idB=await track(savedB);await expect(page.getByRole('dialog')).toHaveCount(0);
   await expect(page.locator('.message-user')).toContainText(a);
   await history();await expect(page.locator('.account-history-list article').filter({hasText:b})).toBeVisible();
   await page.screenshot({path:require('node:path').join(require('node:os').tmpdir(),'jarvis-auth-demo-live.png')});
   await page.locator('.account-history-list article').filter({hasText:b}).locator('button').first().click();
   await expect(page.getByRole('dialog')).toHaveCount(0);
   await expect(page.locator('.message-user')).toContainText(b);
   await page.reload();await expect(page.locator('.account-history-trigger')).toHaveAttribute('aria-label','Аккаунт и история');
   await history();await page.getByRole('button',{name:'Новый',exact:true}).click();await expect(page.locator('.message')).toHaveCount(0);
   await history();await page.locator('.account-history-list article').filter({hasText:a}).locator('button').first().click();await expect(page.locator('.message-user')).toContainText(a);
   await history();
   for(const [id,title]of[[idB,b],[idA,a]]){
     await page.getByRole('button',{name:'Удалить: '+title,exact:true}).click();
     const deleted=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/history/'+id&&r.request().method()==='DELETE');
     await page.getByRole('button',{name:'Удалить',exact:true}).click();assert.equal((await deleted).status(),200);created.delete(id);
     await expect(page.locator('.account-history-list article').filter({hasText:title})).toHaveCount(0);
   }
   await page.getByRole('button',{name:'Выйти',exact:true}).click();await expect(page.locator('.account-history-trigger')).toHaveAttribute('aria-label','Войти');
   assert.equal((await context.request.get(base+'/api/history')).status(),401);assert.deepEqual(errors,[]);
   console.log(JSON.stringify({ok:true,liveAuth:true,liveDatabase:true,assistantMocked:true,checks:['password-demo-login','A-New-autoarchives','B-RestoreA-autoarchivesB','restoreB','reload-New-RestoreA','delete-only-two-owned-probes','logout401'],syntheticRecordsRemaining:0,emailsSent:0}));
 }finally{
   for(const id of created){const cleanup=await context.request.delete(base+'/api/history/'+id);if(!cleanup.ok())console.error('Own synthetic record cleanup failed',cleanup.status());}
   await browser.close();
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
