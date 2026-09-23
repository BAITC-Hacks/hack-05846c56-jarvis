// Isolated Chrome context: never touches the user's browser/cart and never sends mail.
// Start the application first. Chat responses alone are mocked to make retries deterministic
// and avoid model charges; uploads, products, related products and cart use real local APIs.
const { chromium, expect } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const base = process.env.TEST_BASE_URL || 'http://localhost:3000';

(async () => {
  const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || undefined, headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const pass = (name, details = {}) => console.log(JSON.stringify({ pass: name, ...details }));
  const readCart = async () => {
    const response = await context.request.get(base + '/api/cart');
    assert.equal(response.status(), 200);
    return (await response.json()).cart;
  };
  try {
    const detailResponse = await context.request.get(base + '/api/products/515291');
    assert.equal(detailResponse.status(), 200);
    const { product } = await detailResponse.json();
    assert.equal(product.source, 'live');
    assert.ok(product.stock >= 1 && product.price !== null);
    const chatRequests = [];
    await page.route('**/api/chat', async route => {
      chatRequests.push(route.request().postDataJSON());
      if (chatRequests.length === 1) return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'QA: временная ошибка сервиса' }) });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        message: 'Повторная отправка получена. Проверьте товар перед добавлением.',
        products: [product], suggestions: [], sources: [{ title: product.name, url: product.url }], mode: 'catalog',
      }) });
    });
    // Clipboard assertions must not overwrite the real user's system clipboard.
    await page.addInitScript(() => {
      window.__qaCopiedText = null;
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { window.__qaCopiedText = text; } } });
    });
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    // Product tiles appear after hydration + initial fetch; do not dispatch file events before that.
    await page.locator('.drift-wall__tile').first().waitFor();
    const uploadResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/api/upload');
    await page.locator('input[type=file]').setInputFiles({ name: 'qa-retry-specification.txt', mimeType: 'text/plain', buffer: Buffer.from('Артикул;Количество\n200300285_;1') });
    assert.equal((await uploadResponse).status(), 200);
    await expect(page.locator('.prompt-bar__chip')).toHaveCount(1);
    const draft = 'Проверь спецификацию. Пока ничего не добавляй.';
    await page.getByRole('textbox').first().fill(draft);
    await page.getByRole('button', { name: 'Отправить', exact: true }).click();
    await page.getByText('QA: временная ошибка сервиса', { exact: true }).waitFor();
    assert.equal((await readCart()).items.length, 0);
    await expect(page.locator('.message-user')).toHaveCount(1);
    await page.locator('.retry-message').click();
    await page.locator('.message-assistant').waitFor();
    assert.equal(chatRequests.length, 2);
    assert.deepEqual(chatRequests[1].attachments, chatRequests[0].attachments, 'Retry must retain exact parsed attachments');
    assert.deepEqual(chatRequests[1].messages, chatRequests[0].messages, 'Retry must resend the same user turn without duplication');
    assert.equal(chatRequests[1].messages.filter(message => message.role === 'user' && message.content === draft).length, 1);
    await expect(page.locator('.message-user')).toHaveCount(1);
    await expect(page.locator('.message-user .message-attachments')).toContainText('qa-retry-specification.txt');
    pass('failed chat retry preserves input and attachment without duplicate turn');

    // Related-product recommendations must match sourced API records and explain their limits.
    const relatedResponse = page.waitForResponse(response => new URL(response.url()).pathname === `/api/products/${product.id}/related`);
    await page.locator('.message-assistant .product-name').first().click();
    await page.getByRole('dialog', { name: 'Подробнее', exact: true }).waitFor();
    const relatedHttp = await relatedResponse;
    assert.equal(relatedHttp.status(), 200);
    const related = await relatedHttp.json();
    assert.ok(related.items.length, '515291 should have safe catalog-backed accessory ideas');
    const firstRelated = related.items[0];
    const candidate = page.locator('.related-product').filter({ hasText: firstRelated.product.name }).first();
    await expect(candidate).toBeVisible();
    await expect(candidate).toContainText(firstRelated.reason.ru);
    await expect(page.getByRole('dialog')).toContainText(related.notice.ru);
    assert.match(firstRelated.product.url, /^https:\/\/(?:[^/]+\.)?ekt\.kz\//);
    await candidate.click();
    await expect(page.locator('.detail-overview h3')).toHaveText(firstRelated.product.name);
    await expect(page.locator('.detail-footer a')).toHaveAttribute('href', firstRelated.product.url);
    assert.equal((await readCart()).items.length, 0, 'Opening related item must never add it');
    await page.keyboard.press('Escape');
    pass('related product reason, sourcing notice and real product details');

    // Cancel is also tested: proposal is never consent.
    async function prepareOne() {
      await page.locator('.message-assistant .add-button').first().click();
      await page.getByRole('dialog', { name: 'Выберите количество', exact: true }).waitFor();
      await page.getByRole('spinbutton').fill('1');
      await page.getByRole('button', { name: 'Проверим ваш выбор', exact: true }).click();
      await page.getByRole('button', { name: 'Подтвердить', exact: true }).waitFor();
    }
    await prepareOne();
    assert.equal((await readCart()).items.length, 0);
    await page.getByRole('button', { name: 'Отмена', exact: true }).click();
    assert.equal((await readCart()).items.length, 0);
    await prepareOne();
    await page.route('**/api/cart/confirm', route => route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ error: 'QA: срок подтверждения истек', code: 'EXPIRED' }) }));
    await page.getByRole('button', { name: 'Подтвердить', exact: true }).click();
    await page.getByText('QA: срок подтверждения истек', { exact: true }).waitFor();
    await expect(page.getByRole('button', { name: 'Подтвердить', exact: true })).toBeDisabled();
    assert.equal((await readCart()).items.length, 0);
    await page.unroute('**/api/cart/confirm');
    await page.locator('.proposal-refresh').click();
    await expect(page.getByRole('button', { name: 'Подтвердить', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'Подтвердить', exact: true }).click();
    await expect(page.locator('dialog[open]')).toHaveCount(0);
    assert.equal((await readCart()).items[0].quantity, 1);
    const receipt = page.locator('.cart-receipt');
    await expect(receipt).toBeVisible();
    await expect(receipt).toHaveAttribute('href', '/cart');
    // Intentional time boundary: the persistent cart link must outlive the 4.5s toast.
    await page.waitForTimeout(5000);
    await expect(receipt).toBeVisible();
    await receipt.click();
    await expect(page).toHaveURL(/\/cart$/);
    await page.locator('.cart-line').waitFor();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('.cart-line')).toHaveCount(1);
    assert.equal((await readCart()).items[0].quantity, 1);
    pass('cancel is read-only; expired proposal regenerates; explicit confirm survives reload and provides persistent cart anchor');

    await page.getByRole('link', { name: 'Ассистент', exact: true }).click();
    await page.getByRole('button', { name: 'Связаться с менеджером', exact: true }).first().click();
    const manager = page.getByRole('dialog', { name: 'Связаться с менеджером', exact: true });
    await manager.waitFor();
    await manager.locator('.handoff-field select').selectOption({ label: 'Астана' });
    const message = manager.locator('.handoff-field textarea');
    await message.fill(`QA: уточните поставку в Астану. Артикул ${product.sku}.`);
    await manager.getByRole('button', { name: 'Скопировать', exact: true }).click();
    await manager.getByRole('button', { name: 'Скопировано', exact: true }).waitFor();
    assert.equal(await page.evaluate(() => window.__qaCopiedText), await message.inputValue());
    const downloadEvent = page.waitForEvent('download');
    await manager.getByRole('button', { name: 'Скачать запрос', exact: true }).click();
    const download = await downloadEvent;
    assert.equal(download.suggestedFilename(), 'Jarvis-EKT-request.txt');
    const text = await fs.readFile(await download.path(), 'utf8');
    assert.equal(text.replace(/^\uFEFF/, ''), await message.inputValue());
    // Inspect only: opening mailto/tel would invoke an external mail or phone application.
    const mailto = await manager.getByRole('link', { name: 'Открыть письмо', exact: true }).getAttribute('href');
    assert.ok(mailto.startsWith('mailto:astana@ekt.kz?'));
    assert.equal(new URL(mailto).searchParams.get('body'), await message.inputValue());
    await expect(manager.locator('a[href^="tel:"]')).toHaveAttribute('href', 'tel:+77002220514');
    await expect(manager.getByRole('link', { name: 'Контакты на сайте EKT' })).toHaveAttribute('href', 'https://ekt.kz/about/contacts/');
    await page.keyboard.press('Escape');
    await expect(page.locator('dialog[open]')).toHaveCount(0);
    pass('manager city, edited request, safe clipboard/download and inspected mailto links; nothing sent');

    // Remove the item through the same explicit UI flow; own context only.
    await page.getByRole('link', { name: 'Корзина', exact: true }).click();
    await page.locator('.cart-line-actions>button').click();
    await page.getByRole('button', { name: 'Подтвердить', exact: true }).click();
    await page.locator('.cart-empty').waitFor();
    assert.equal((await readCart()).items.length, 0);
    assert.deepEqual(errors, []);
    pass('private cart empty and no browser runtime errors');
  } catch (error) {
    await fs.mkdir('test-results', { recursive: true });
    await page.screenshot({ path: 'test-results/reliability-failure.png', fullPage: true }).catch(() => {});
    throw error;
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
