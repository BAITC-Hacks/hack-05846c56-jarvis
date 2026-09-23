import assert from 'node:assert/strict';
import { test } from 'node:test';
import { historyMessageSchema, saveHistorySchema, storedHistoryMessages, type HistoryMessage } from '../src/lib/history-types';
import { normalizeProduct } from '../src/lib/catalog';
import { PAYMENT_REDACTION_TEXT } from '../src/lib/payment-privacy';

test('history persists historical text and IDs, never submitted product prices or file blobs', () => {
  const product = normalizeProduct({ id: 515291, name: 'Товар', price: 999, quantity: 1, url: 'https://ekt.kz/catalog/' });
  const input = { id:'one', role:'assistant', content:'Историческая цена 999 ₸', products:[product], attachments:['spec.pdf'], dataUrl:'data:application/pdf;base64,PRIVATE', proposedItems:[{productId:'515291',quantity:100}], cartUrl:'/cart' } as HistoryMessage;
  const stored = storedHistoryMessages([input])[0];
  assert.deepEqual(stored.productIds, ['515291']);
  assert.equal(stored.content, 'Историческая цена 999 ₸');
  assert.equal(stored.cartUrl, '/cart');
  const serialized = JSON.stringify(stored);
  for (const forbidden of ['dataUrl','PRIVATE','proposedItems','price','stock']) assert.ok(!serialized.includes(forbidden));
});
test('untrusted history cannot inject system roles, executable sources or external cart receipt links', () => {
  const base = {id:'one',role:'user',content:'test'};
  assert.equal(historyMessageSchema.safeParse({...base,role:'system'}).success,false);
  assert.equal(historyMessageSchema.safeParse({...base,sources:[{title:'bad',url:'javascript:alert(1)'}]}).success,false);
  assert.equal(historyMessageSchema.safeParse({...base,cartUrl:'https://evil.test/cart'}).success,false);
  assert.equal(historyMessageSchema.safeParse({...base,productIds:['../../private']}).success,false);
});
test('updates require optimistic revision and message storage remains bounded', () => {
  const message={id:'one',role:'user' as const,content:'test'};
  const create={locale:'ru',messages:[message]};
  assert.equal(saveHistorySchema.safeParse(create).success,true);
  assert.equal(saveHistorySchema.safeParse({...create,id:'734d8f5d-79c4-4938-bd73-22882a9ca638'}).success,false);
  assert.equal(saveHistorySchema.safeParse({...create,id:'734d8f5d-79c4-4938-bd73-22882a9ca638',revision:1}).success,true);
  assert.equal(saveHistorySchema.safeParse({...create,messages:Array.from({length:101},()=>message)}).success,false);
  assert.equal(saveHistorySchema.safeParse({...create,messages:[{...message,content:'x'.repeat(20001)}]}).success,false);
  assert.equal(saveHistorySchema.safeParse({...create,userId:'forged-user'}).success,true);
  assert.equal('userId' in saveHistorySchema.parse({...create,userId:'forged-user'}),false);
});

test('server history schema and serializer redact payment text and titles without damaging product data', () => {
 const sensitive='Карта: 4111111111111111, CVV: 123, IBAN KZ86125KZT5004100100';
 const input={locale:'ru',title:sensitive,messages:[{id:'one',role:'user' as const,content:sensitive+'; артикул 200300285_ и 19281, 2 шт, 160А, 64920 ₸',productIds:['515291','19281']}]};
 const saved=saveHistorySchema.parse(input); const stored=storedHistoryMessages(input.messages);
 for(const value of [saved.title!,saved.messages[0].content,stored[0].content]){
  assert.doesNotMatch(value,/4111111111111111|CVV: 123|KZ86125KZT5004100100/);assert.ok(value.includes(PAYMENT_REDACTION_TEXT));
 }
 assert.match(saved.messages[0].content,/200300285_ и 19281, 2 шт, 160А, 64920 ₸/);
 assert.deepEqual(saved.messages[0].productIds,['515291','19281']);
 assert.equal(input.title,sensitive,'caller input is not mutated');
});
