// React state/UX regression using MOCK authentication, history storage and chat.
// This does NOT verify real login, sessions, email delivery, SQL or owner isolation.
// Product fixtures come from read-only local catalog API; no orders/cart mutations.
// Every auth route is intercepted: no real account or email is ever requested.
const { chromium, expect } = require('@playwright/test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const base = process.env.TEST_BASE_URL || 'http://localhost:3000';

(async () => {
  const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || undefined, headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  const errors = [], saves = [], deletes = [], authRequests = [];
  const archive = new Map();
  let signedIn = true, replies = 0, rejectSave = false, holdNextSave = false, releaseSave;
  const reads = [];
  const user = { id: 'qa-mock-owner', email: 'qa@example.invalid', name: 'QA Mock Account' };
  page.on('pageerror', error => errors.push(error.message));
  const json = (route, data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
  const summary = ({ messages, ...rest }) => ({ ...rest, messageCount: messages.length });
  const pass = name => console.log(JSON.stringify({ pass: name, scope: 'mock API / real React UI' }));
  try {
    const response = await context.request.get(base + '/api/products/515291');
    assert.equal(response.status(), 200);
    const { product } = await response.json();
    await page.route('**/api/auth/**', async route => {
      const pathname = new URL(route.request().url()).pathname;
      authRequests.push({ pathname, method: route.request().method() });
      if (pathname.endsWith('/sign-out')) { signedIn = false; return json(route, { success: true }); }
      // Auth client may refresh session after signing out. Never forward it.
      if (pathname.endsWith('/get-session')) return json(route, null);
      return json(route, { error: 'QA blocked unexpected auth operation' }, 400);
    });
    await page.route('**/api/history**', async route => {
      const request = route.request(), path = new URL(request.url()).pathname;
      if (!signedIn) return json(route, { error: 'Unauthorized' }, 401);
      const id = path.startsWith('/api/history/') ? path.slice('/api/history/'.length) : null;
      if (request.method() === 'GET') {
        if (id) { reads.push(id); const stored=archive.get(id); return json(route, { conversation: stored ? {...stored,messages:stored.messages.map(message=>message.role==='assistant'?{...message,products:[product],cartUrl:'/cart'}:message)} : undefined }, archive.has(id) ? 200 : 404); }
        return json(route, { user, conversations: [...archive.values()].map(summary) });
      }
      if (request.method() === 'DELETE') { deletes.push(id); archive.delete(id); return json(route, { ok: true }); }
      assert.equal(request.method(), 'POST');
      const body = request.postDataJSON(); saves.push(body);
      if (holdNextSave) { holdNextSave=false; await new Promise(resolve=>{releaseSave=resolve;}); }
      if (rejectSave) return json(route,{error:'QA сохранение отклонено: конфликт'},409);
      const old = body.id && archive.get(body.id);
      if (body.id && (!old || old.revision !== body.revision)) return json(route, { error: 'Revision conflict' }, 409);
      const next = { id: body.id || randomUUID(), title: body.messages[0].content.slice(0, 60), locale: body.locale, revision: (old?.revision || 0) + 1, createdAt: old?.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString(), messages: body.messages };
      archive.set(next.id, next);
      return json(route, { conversation: summary(next) });
    });
    await page.route('**/api/chat', route => json(route, { message: `QA ответ ${++replies}`, products: [product], sources: [{ title: 'EKT', url: product.url }], suggestions: [], mode: 'catalog' }));
    const send = async text => {
      const expectedReply = replies + 1;
      await page.getByRole('textbox').first().fill(text);
      await page.getByRole('button', { name: 'Отправить', exact: true }).click();
      await page.getByText(`QA ответ ${expectedReply}`, { exact: true }).waitFor();
    };
    const openHistory = async () => { await page.getByRole('button', { name: 'Аккаунт и история', exact: true }).click(); await page.getByRole('dialog', { name: 'История диалогов' }).waitFor(); };
    const closeHistory = () => page.getByRole('dialog').getByRole('button', { name: 'Закрыть', exact: true }).click();

    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: 'Аккаунт и история', exact: true })).toBeEnabled();
    const newChat=()=>page.locator('.conversation-actions').getByRole('button',{name:'Новый диалог',exact:true});
    const restore=async title=>{await openHistory();await page.locator('.account-history-list article').filter({hasText:title}).locator('button').first().click();await expect(page.getByRole('dialog')).toHaveCount(0);};
    await send('QA первый диалог');
    await page.waitForTimeout(1400);assert.equal(saves.length,0,'Login/chat alone does not save a guest-origin conversation');
    await newChat().evaluate(button=>{button.click();button.click();});
    await expect(page.locator('.message')).toHaveCount(0);
    assert.equal(saves.length,1);assert.equal(archive.size,1);
    const firstId=[...archive.keys()][0];assert.equal(archive.get(firstId).messages.length,2);
    pass('New automatically archives first unsaved chat once, despite double click');

    await send('QA второй диалог');
    await restore('QA первый диалог');
    assert.equal(archive.size,2);const secondId=[...archive.keys()].find(id=>id!==firstId);
    assert.equal(archive.get(secondId).messages[0].content,'QA второй диалог');
    await expect(page.locator('.message-user .message-text')).toHaveText(['QA первый диалог']);
    await expect(page.locator('.message-products')).toHaveCount(1);
    await expect(page.locator('.cart-receipt')).toHaveAttribute('href','/cart');
    pass('Restoring A first archives unsaved B; both remain independently recoverable');

    holdNextSave=true;await send('QA продолжение A');
    await expect.poll(()=>typeof releaseSave).toBe('function');
    await send('QA самая свежая реплика A');
    await newChat().click();
    releaseSave();
    await expect(page.locator('.message')).toHaveCount(0);
    assert.equal(archive.get(firstId).messages.length,6);
    assert.equal(archive.get(firstId).messages.at(-2).content,'QA самая свежая реплика A');
    assert.equal(archive.get(firstId).revision,3);
    assert.equal(saves.filter(body=>body.id===firstId).length,2);
    pass('New waits for in-flight autosave and then flushes the latest turn at the next revision');
    const countBeforeEmpty=saves.length;
    await page.getByRole('button',{name:'Начать подбор',exact:true}).click();
    await expect(page.locator('.message')).toHaveCount(0);assert.equal(saves.length,countBeforeEmpty);
    pass('Empty New through header does not create an empty archive');

    await restore('QA второй диалог');
    rejectSave=true;await send('QA B остаётся при ошибке');
    await openHistory();const readsBefore=reads.length;
    await page.locator('.account-history-list article').filter({hasText:'QA первый диалог'}).locator('button').first().click();
    await expect(page.getByRole('dialog').getByRole('alert')).toContainText('QA сохранение отклонено');
    assert.equal(reads.length,readsBefore,'Target history must not load when current save failed');
    await expect(page.locator('.message-user .message-text')).toHaveText(['QA второй диалог','QA B остаётся при ошибке']);
    assert.equal(await page.evaluate(()=>sessionStorage.getItem('jarvis-conversation-id')),secondId);
    await closeHistory();await newChat().click();
    await expect(page.getByRole('dialog').getByRole('alert')).toContainText('QA сохранение отклонено');
    await expect(page.locator('.message-user')).toHaveCount(2);
    pass('Rejected restore and New leave current messages and current id untouched');

    rejectSave=false;await page.getByRole('button',{name:'Новый',exact:true}).click();
    await expect(page.locator('.message')).toHaveCount(0);assert.equal(archive.get(secondId).messages.length,4);
    await restore('QA первый диалог');
    const beforeReload=saves.length;await page.reload({waitUntil:'domcontentloaded'});
    await expect(page.getByRole('button',{name:'Аккаунт и история',exact:true})).toBeEnabled();
    await newChat().click();await expect(page.locator('.message')).toHaveCount(0);
    assert.equal(archive.size,2,'Reload must retain the original conversation id rather than duplicate it');
    assert.ok(saves.length<=beforeReload+1);
    await restore('QA первый диалог');
    await openHistory();await page.getByRole('button',{name:'Удалить: QA второй диалог',exact:true}).click();
    assert.equal(deletes.length,0);await page.getByRole('button',{name:'Отмена',exact:true}).click();
    await page.getByRole('button',{name:'Удалить: QA второй диалог',exact:true}).click();
    await page.getByRole('button',{name:'Удалить',exact:true}).click();
    await expect(page.locator('.account-history-list article')).toHaveCount(1);assert.deepEqual(deletes,[secondId]);
    pass('Reload reuses active id; delete remains explicit and touches only selected chat');

    await closeHistory();rejectSave=true;await send('QA несохранённая реплика перед выходом');
    await expect.poll(()=>saves.length).toBeGreaterThan(beforeReload);
    await openHistory();await page.getByRole('button',{name:'Выйти',exact:true}).click();
    await expect(page.getByRole('button',{name:'Войти',exact:true})).toBeVisible();
    await expect(page.locator('.message')).toHaveCount(0);
    assert.equal(archive.size,1,'Logout never deletes stored history');
    await expect.poll(()=>page.evaluate(()=>JSON.parse(sessionStorage.getItem('jarvis-chat')||'[]').length)).toBe(0);
    await page.reload({waitUntil:'domcontentloaded'});
    await expect(page.getByRole('button',{name:'Войти',exact:true})).toBeEnabled();
    await expect(page.locator('.message')).toHaveCount(0);assert.deepEqual(errors,[]);
    pass('Logout stays available after history failure and clears local private chat');
    console.log(JSON.stringify({result:'PASS',saves:saves.length,deletes:deletes.length,realAuthOrEmailRequests:0,note:'Mock auth/history regression only.'}));
  } finally { await context.close(); await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
