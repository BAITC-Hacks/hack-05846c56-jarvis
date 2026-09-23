// React state/UX regression using MOCK authentication, history storage and chat.
// This does NOT verify real login, sessions, email delivery, SQL or owner isolation.
// Product fixtures come from read-only local catalog API; no orders/cart mutations.
// Every auth route is intercepted: no real account or email is ever requested.
const { chromium, expect } = require('@playwright/test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const base = process.env.TEST_BASE_URL || 'http://localhost:3000';

(async () => {
  const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  const errors = [], saves = [], deletes = [], authRequests = [];
  const archive = new Map();
  let signedIn = true, replies = 0;
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
        if (id) return json(route, { conversation: archive.get(id) }, archive.has(id) ? 200 : 404);
        return json(route, { user, conversations: [...archive.values()].map(summary) });
      }
      if (request.method() === 'DELETE') { deletes.push(id); archive.delete(id); return json(route, { ok: true }); }
      assert.equal(request.method(), 'POST');
      const body = request.postDataJSON(); saves.push(body);
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
    await send('QA первый диалог');
    // First save must not happen merely because a signed-in user chats.
    await page.waitForTimeout(1500);
    assert.equal(saves.length, 0);
    await openHistory();
    await page.getByRole('button', { name: 'Сохранить диалог', exact: true }).click();
    await expect(page.locator('.account-history-list article.is-current')).toHaveCount(1);
    assert.equal(saves.length, 1); assert.equal(saves[0].id, undefined); assert.equal(saves[0].revision, undefined);
    const firstId = [...archive.keys()][0];
    await closeHistory();
    await send('QA продолжение');
    await expect.poll(() => saves.length).toBe(2);
    assert.equal(saves[1].id, firstId); assert.equal(saves[1].revision, 1); assert.equal(saves[1].messages.length, 4);
    assert.deepEqual(saves[1].messages.at(-1).productIds, [product.id]);
    assert.equal(saves[1].messages.at(-1).products, undefined);
    pass('explicit first save attaches id; assistant reply auto-saves correct id/revision without product blobs');

    await page.locator('.conversation-actions').getByRole('button', { name: 'Новый диалог', exact: true }).click();
    await page.getByRole('button', { name: 'Начать заново', exact: true }).click();
    await expect(page.locator('.message')).toHaveCount(0);
    await openHistory();
    await expect(page.locator('.account-history-list article')).toHaveCount(1);
    await expect(page.locator('.account-history-list article.is-current')).toHaveCount(0);
    await closeHistory();
    await send('QA второй диалог');
    await page.waitForTimeout(1500);
    assert.equal(saves.length, 2, 'New conversation must not overwrite previous saved id');
    await openHistory();
    await page.getByRole('button', { name: 'Сохранить диалог', exact: true }).click();
    await expect(page.locator('.account-history-list article')).toHaveCount(2);
    assert.equal(saves[2].id, undefined);
    const secondId = [...archive.keys()].find(id => id !== firstId);
    pass('new conversation clears active id while retaining archive; next save creates another id');

    // Simulate API enrichment: storage keeps IDs, restored endpoint returns current product cards.
    const restored = archive.get(firstId);
    restored.messages = restored.messages.map(message => message.role === 'assistant' ? { ...message, products: [product], cartUrl: '/cart' } : message);
    await page.locator('.account-history-list article').filter({ hasText: 'QA первый диалог' }).locator('button').first().click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator('.message-user')).toHaveCount(2);
    await expect(page.locator('.message-products')).toHaveCount(2);
    await expect(page.locator('.message-products').first()).toContainText(product.name);
    await expect(page.locator('.cart-receipt').first()).toHaveAttribute('href', '/cart');
    await page.locator('.cart-receipt').first().click();
    await expect(page).toHaveURL(base + '/cart');
    pass('restored history renders historical text, enriched product cards and navigable current-cart link');

    await openHistory();
    await page.getByRole('button', { name: 'Удалить: QA второй диалог', exact: true }).click();
    assert.equal(deletes.length, 0, 'Delete requires confirmation');
    await page.getByRole('button', { name: 'Отмена', exact: true }).click();
    assert.equal(deletes.length, 0);
    await page.getByRole('button', { name: 'Удалить: QA второй диалог', exact: true }).click();
    await page.getByRole('button', { name: 'Удалить', exact: true }).click();
    await expect(page.locator('.account-history-list article')).toHaveCount(1);
    assert.deepEqual(deletes, [secondId]);
    pass('delete cancel is read-only; explicit confirmation removes only selected archive');

    await page.getByRole('button', { name: 'Выйти', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Войти', exact: true })).toBeVisible();
    await expect(page.locator('.message')).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem('jarvis-chat') || '[]').length)).toBe(0);
    assert.equal(archive.size, 1, 'Sign-out should not erase saved account history');
    assert.equal(authRequests.filter(request => request.pathname.endsWith('/sign-out')).length, 1);
    // Remount verifies initial 401 keeps account UI and conversation cleared.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: 'Войти', exact: true })).toBeEnabled();
    await expect(page.locator('.message')).toHaveCount(0);
    assert.deepEqual(errors, []);
    pass('mock sign-out + history 401 clears account conversation and guest session copy; zero page errors');
    console.log(JSON.stringify({ result: 'PASS', saves: saves.length, deletes: deletes.length, mockAuthRequests: authRequests, realAuthOrEmailRequests: 0, note: 'Mock auth/history regression only; no real SQL/login claim.' }));
  } finally { await context.close(); await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
