import assert from 'node:assert/strict';
import { test } from 'node:test';
import { allProducts, normalizeProduct } from '../src/lib/catalog';
import { catalogRecommendationIds, getRelatedProducts, isEktSource, selectRelatedProducts } from '../src/lib/related';
import type { Product } from '../src/lib/types';

const products = allProducts();
const offline = async (id: string) => products.find(product => product.id === id) || null;
const breaker = products.find(product => product.id === '515291')!;
const cable = products.find(product => product.id === '30554')!;
const tag = products.find(product => product.id === '20966')!;

test('real 515291 metadata recommends 32A connector and 25A assembled panel, never claim a compatible kit', () => {
  assert.deepEqual(catalogRecommendationIds('515291'), ['48783', '23466', '28727']);
  const unsafe = [
    normalizeProduct({ id: 48783, name: 'Клемма 32А WAGO', quantity: 50, url: 'https://ekt.kz/catalog/terminals/' }),
    normalizeProduct({ id: 28727, name: 'ЩРУн укомплектованный 25А', quantity: 3, url: 'https://ekt.kz/catalog/boards/' }),
    cable,
  ];
  assert.equal(selectRelatedProducts(breaker, unsafe, catalogRecommendationIds('515291')).length, 0);
});

test('real SKU 200300285_ and id 515291 resolve the same sourced accessory proposals', async () => {
  const byId = await getRelatedProducts('515291', 3, offline);
  const bySku = await getRelatedProducts('200300285_', 3, offline);
  assert.ok(byId && bySku);
  assert.equal(byId.baseProductId, '515291');
  assert.deepEqual(byId.items.map(item => item.product.id), bySku.items.map(item => item.product.id));
  assert.equal(byId.items.length, 3);
  assert.ok(byId.items.every(item => item.product.stock > 0 && isEktSource(item.sourceUrl) && item.product.source === 'snapshot'));
  assert.ok(byId.items.every(item => item.reason.ru && item.reason.kk));
  assert.match(byId.notice.ru, /не подтверждённый совместимый комплект/);
});

test('real cable 30554 receives three existing accessories without another cable substitution', async () => {
  const response = await getRelatedProducts('30554', 3, offline);
  assert.ok(response);
  assert.equal(response.items.length, 3);
  assert.ok(response.items.some(item => /изолента/i.test(item.product.name)));
  assert.ok(response.items.some(item => /бирка/i.test(item.product.name)));
  assert.ok(response.items.every(item => item.product.id !== cable.id && item.product.category !== 'Кабель и провод'));
});

test('index-only candidates must hydrate before exposure and hydrate failures are omitted', async () => {
  const calls: { id: string; fresh: boolean | undefined }[] = [];
  const response = await getRelatedProducts('30554', 4, async (id, options) => {
    calls.push({ id, fresh: options?.fresh });
    if (id === cable.id) return cable;
    if (id === tag.id) return { ...tag, stock: 0 };
    throw new Error('source unavailable');
  });
  assert.ok(response);
  assert.deepEqual(response.items, []);
  assert.ok(calls.length > 1);
  assert.ok(calls.slice(1).every(call => call.fresh === true));
});

test('explicit safe recommendation retains catalogue provenance and bilingual caveat', () => {
  const result = selectRelatedProducts(cable, [tag], [tag.id]);
  assert.equal(result.length, 1);
  assert.equal(result[0].basis, 'catalog-recommendation');
  assert.equal(result[0].sourceUrl, cable.url);
  assert.match(result[0].reason.ru, /RECOMMEND/);
  assert.match(result[0].reason.kk, /RECOMMEND/);
});

test('dedupe, max four, unknown category, invalid product and external links fail closed', async () => {
  const invalids: Product[] = [{ ...tag, source: 'demo' }, { ...tag, id: '111', stock: 0 }, { ...tag, id: '112', url: 'https://ekt.kz.evil.test/product' }, { ...tag, id: '113', fetchedAt: 'unknown' }];
  assert.deepEqual(selectRelatedProducts(cable, invalids), []);
  const duplicates = selectRelatedProducts(cable, [tag, tag], [], 100);
  assert.equal(duplicates.length, 1);
  assert.deepEqual(selectRelatedProducts({ ...cable, category: 'Неизвестная категория' }, products), []);
  assert.equal(await getRelatedProducts('not-an-exact-sku', 3, offline), null);
  assert.equal(await getRelatedProducts('../515291', 3, offline), null);
  for (const url of ['javascript:alert(1)', 'https://ekt.kz.evil.test/a', 'https://evil.test/ekt.kz']) assert.equal(isEktSource(url), false);
});
