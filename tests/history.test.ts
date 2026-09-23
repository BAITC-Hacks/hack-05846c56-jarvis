import assert from 'node:assert/strict';
import { test } from 'node:test';
import { historyMessageSchema, saveHistorySchema, storedHistoryMessages, type HistoryMessage } from '../src/lib/history-types';
import { normalizeProduct } from '../src/lib/catalog';

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
