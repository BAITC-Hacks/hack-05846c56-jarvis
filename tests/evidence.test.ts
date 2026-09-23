import assert from 'node:assert/strict';
import { test } from 'node:test';
import { matchesVisualEvidence, comparisonRows, exactProductReference, type VisualEvidence } from '../src/lib/evidence';
import { normalizeProduct, searchLocal } from '../src/lib/catalog';
import { cartBrief } from '../src/lib/cart-brief';
import { answerAssistant } from '../src/lib/assistant';
const evidence: VisualEvidence = { kind: 'breaker', description: 'Автомат', brand: 'Legrand', model: 'DRX 250', markings: ['DRX 250', 'In=160A'], uncertain: '' };
const breaker = searchLocal('200300285_')[0];
test('photo retrieval retains exact model despite catalog contradiction and rejects mounting accessories', () => {
  assert.equal(matchesVisualEvidence(breaker, evidence), true);
  assert.equal(matchesVisualEvidence({ ...breaker, category: 'Монтаж и инструмент' }, evidence), false);
  assert.equal(matchesVisualEvidence({ ...breaker, brand: 'Schneider', name: 'ABL2 mounting accessory' }, evidence), false);
});
test('photo retrieval refuses a different legible rating and unrecognized images', () => {
  assert.equal(matchesVisualEvidence({ ...breaker, name: 'Legrand DRX250 250A', specs: { NOMINALNYY_TOK: '250 А' } }, evidence), false);
  assert.equal(matchesVisualEvidence(breaker, { ...evidence, kind: 'unknown' }), false);
});
test('photo without planner does not fall through to unrelated text matches or a cart proposal', async () => {
  const saved = process.env.OPENAI_API_KEY; delete process.env.OPENAI_API_KEY;
  try { const result = await answerAssistant({ locale: 'ru', messages: [{ role: 'user', content: 'Что на фото? Добавь 2 шт' }], attachments: [{ name: 'x.jpg', type: 'image/jpeg', dataUrl: 'data:image/jpeg;base64,AA==' }] }); assert.equal(result.products.length, 0); assert.equal(result.proposedItems, undefined); assert.match(result.message, /маркировку/); }
  finally { if (saved) process.env.OPENAI_API_KEY = saved; }
});
test('document exact match requires a whole SKU or supplier article, not a substring', () => {
  assert.equal(exactProductReference(breaker, '200300285_'), true);
  assert.equal(exactProductReference(breaker, '027228'), true);
  assert.equal(exactProductReference(breaker, '200300'), false);
});
test('comparison displays missing specifications as unknown and distinguishes differences', () => {
  const rows = comparisonRows([{ ...breaker, specs: { 'Ток': '16 А', 'Полюсы': '3', NOMINAL: '16' } }, { ...breaker, specs: { 'Полюсы': '3' } }]);
  assert.equal(rows.length, 2); assert.deepEqual(rows.find(row => row.key === 'Ток')?.values, ['16 А', '—']);
  assert.equal(rows.find(row => row.key === 'Ток')?.different, true); assert.equal(rows.find(row => row.key === 'Полюсы')?.different, false);
});
test('manager brief preserves quantities and source contradictions, does not treat unknown prices as zero', () => {
  const product = normalizeProduct({ id: 10, name: 'Товар без цены', price: null, quantity: 3 });
  const brief = cartBrief({ id: 'test', mode: 'prototype', items: [{ product: breaker, quantity: 2 }, { product, quantity: 1 }], total: breaker.price! * 2, updatedAt: new Date().toISOString() }, 'ru');
  assert.match(brief, /2 шт/); assert.match(brief, /Противоречие источника/); assert.match(brief, /без цены в итог не включены/); assert.match(brief, /Заказ не оформлен/); assert.ok(brief.includes(breaker.url));
});
