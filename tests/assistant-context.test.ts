import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ChatMessage, Product } from '../src/lib/types';
import { answerDeterministically, type AssistantCatalog } from '../src/lib/assistant-deterministic';
import { explicitQuantity, referenceTokens, matchesReference } from '../src/lib/assistant-context';
import { parseBudget } from '../src/lib/assistant';

const product = (id: string, extra: Partial<Product> = {}): Product => ({
 id, sku: id === '10001' ? '11054DEK' : `sku-${id}`, name: `Автомат ${id} 16А`, category: 'Автоматы и защита', brand: 'Test', price: 1200, currency: 'KZT', stock: 10, unit: 'шт', image: null,
 url: `https://ekt.kz/catalog/${id}/`, description: '', specs: { NOMINALNYY_TOK: '16 А', KOLICHESTVO_POLYUSOV: '1', NOMINALNOE_NAPRYAZHENIE: '230В', KRATNOST_MIN: '1' }, certificates: [], warehouses: [{ name: 'Алматы', stock: 10 }], source: 'live', fetchedAt: '2026-09-23T10:00:00Z', ...extra
});
function harness(items = [product('10001'), product('10002')]) {
 const calls: { search: string[]; fresh: string[]; analog: string[] } = { search: [], fresh: [], analog: [] };
 const catalog: AssistantCatalog = {
  async searchProducts(query) { calls.search.push(query); return items.filter(p => matchesReference(p, query)); },
  async getProduct(id, options) { if(options?.fresh)calls.fresh.push(id);return items.find(p => p.id === id) || null; },
  async getAnalogProducts(id) { calls.analog.push(id);return items.filter(p => p.id !== id && p.stock > 0).map(p => ({ product: p, reason: 'Совпадают: Номинальный ток — 16 А; Количество полюсов — 1.', warnings: [] })); }
 };
 const run = (content: string, history: ChatMessage[] = [], locale: 'ru' | 'kk' = 'ru', supplied: string[] = []) => {
  const budget = parseBudget(content);
  return answerDeterministically({ messages: [...history, { role: 'user', content }], locale, text: budget.text, maxPrice: budget.maxPrice, contextProductIds: supplied }, catalog);
 };
 return { calls, run, catalog };
}
const shown = (ids = ['10001']): ChatMessage => ({ role: 'assistant', content: 'Вот товары', productIds: ids });
const quantityPrompt = (id = '10001'): ChatMessage => ({ role: 'assistant', content: 'Сколько шт добавить? Укажите количество.', productIds: [id] });

test('exact alphanumeric SKU uses one fresh catalogue lookup and no generated prose', async () => {
 const { run, calls } = harness();const response = await run('Наличие 11054DEK');
 assert.equal(response?.mode, 'catalog');assert.deepEqual(calls.search, ['11054DEK']);assert.deepEqual(calls.fresh, ['10001']);assert.equal(response?.products[0].id, '10001');assert.match(response!.message, /Остаток: 10/);assert.match(response!.message, /Алматы — 10/);
});
test('RU and KK pronouns resolve only a single displayed product', async () => {
 const { run } = harness();for(const [text, locale] of [['Какие у него характеристики?', 'ru'], ['Оның номиналды тогы қандай?', 'kk']] as const){const response=await run(text,[shown()],locale);assert.equal(response?.products[0].id,'10001');assert.match(response!.message,/16 А/);assert.equal(response?.mode,'catalog');}
});
test('ambiguous pronoun/cart cannot select first item from multiple candidates', async () => {
 const { run, calls } = harness();for(const text of ['Какие у него характеристики?', 'Да добавь 2 шт']){const response=await run(text,[shown(['10001','10002'])]);assert.equal(response?.proposedItems,undefined);assert.match(response!.message,/Какой именно товар/);}assert.deepEqual(calls.fresh,[]);
});
test('explicit ordinal selects second product, with matching displayed order', async () => {
 const { run } = harness();const response=await run('Добавь второй, 2 шт',[shown(['10001','10002'])]);assert.deepEqual(response?.proposedItems,[{productId:'10002',quantity:2}]);
});
test('current context is latest product list, not concatenated older ids', async () => {
 const { run } = harness();const response=await run('его характеристики',[shown(['10001']),{role:'user',content:'Теперь другой'},shown(['10002'])],'ru',['10001']);assert.equal(response?.products[0].id,'10002');
});
test('short quantity reply completes an actual quantity clarification', async () => {
 const { run } = harness();const response=await run('2 шт',[{role:'user',content:'Добавь 11054DEK'},quantityPrompt()]);assert.deepEqual(response?.proposedItems,[{productId:'10001',quantity:2}]);assert.match(response!.message,/ещё не добавлен/);
});
test('bare number is quantity only in quantity clarification context', async () => {
 const { run } = harness();assert.equal(explicitQuantity('16А'),undefined);assert.equal(explicitQuantity('230В'),undefined);assert.equal(explicitQuantity('515291'),undefined);assert.equal(explicitQuantity('2'),undefined);assert.equal(explicitQuantity('2',true),2);const response=await run('3',[quantityPrompt()]);assert.deepEqual(response?.proposedItems,[{productId:'10001',quantity:3}]);
});
test('affirmative add can reuse explicit count from relevant prior user turn', async () => {
 const { run } = harness();const response=await run('Да добавь',[{role:'user',content:'Мне нужно 2 шт 11054DEK'},shown()]);assert.deepEqual(response?.proposedItems,[{productId:'10001',quantity:2}]);
});
test('affirmative add after quantity-only response preserves count', async () => {
 const { run } = harness();const response=await run('Да добавь',[quantityPrompt(),{role:'user',content:'2 шт'},{role:'assistant',content:'Подготовил предложение',productIds:['10001']}]);assert.deepEqual(response?.proposedItems,[{productId:'10001',quantity:2}]);
});
test('quantity of a different previous product is not reused', async () => {
 const { run } = harness();const response=await run('Да добавь',[{role:'user',content:'Добавь 2 шт sku-10002'},shown(['10001'])]);assert.equal(response?.proposedItems,undefined);assert.match(response!.message,/Сколько шт/);
});
test('old count cannot be recovered through unrelated intervening user turn', async () => {
 const { run } = harness();const response=await run('Да добавь',[{role:'user',content:'Добавь 3 шт 11054DEK'},shown(),{role:'user',content:'Сколько стоит?'},shown()]);assert.equal(response?.proposedItems,undefined);assert.match(response!.message,/Сколько шт/);
});
test('electrical rating, article and budget never become count', async () => {
 const { run } = harness();const response=await run('Добавь 11054DEK 16А. Бюджет: до 20000 тенге за единицу',[shown()]);assert.equal(response?.proposedItems,undefined);assert.match(response!.message,/Сколько шт/);assert.deepEqual(referenceTokens('2 шт 16А 3P 230В 3х2,5 10000 тенге 11054DEK'),['11054DEK']);
});
test('negative, conflicting and zero quantities cannot create a proposal', async () => {
 const {run}=harness();for(const text of ['Добавь -2 шт 11054DEK','Добавь 0 шт 11054DEK','Добавь 2 шт и 3 шт 11054DEK','Не добавляй 2 шт 11054DEK']){const response=await run(text);assert.equal(response?.proposedItems,undefined,text);}
});
test('Kazakh quantity clarification creates a proposal only, with original count', async () => {
 const { run } = harness();const response=await run('2 дана',[{role:'user',content:'11054DEK себетке қос'},{role:'assistant',content:'Қанша дана қосу керек? Санын жазыңыз.',productIds:['10001']}],'kk');assert.deepEqual(response?.proposedItems,[{productId:'10001',quantity:2}]);assert.match(response!.message,/әлі қосылған жоқ/);
});
test('missing product automatically offers stocked analog with explanation and source', async () => {
 const { run,calls } = harness([product('10001',{stock:0}),product('10002')]);const response=await run('Наличие 11054DEK');assert.deepEqual(calls.analog,['10001']);assert.deepEqual(response?.products.map(p=>p.id),['10002']);assert.equal(response?.proposedItems,undefined);assert.match(response!.message,/Остаток: 0/);assert.match(response!.message,/Номинальный ток — 16 А/);assert.equal(response?.sources.length,2);
});
test('first analog corresponds to first returned card, not unavailable original', async () => {
 const { run } = harness([product('10001',{stock:0}),product('10002')]);const first=await run('11054DEK');const response=await run('Добавь первый 2 шт',[{role:'assistant',content:first!.message,productIds:first!.products.map(p=>p.id)}]);assert.deepEqual(response?.proposedItems,[{productId:'10002',quantity:2}]);
});
test('snapshot fallback says snapshot and timestamp, never checked live now', async () => {
 const {run}=harness([product('10001',{source:'snapshot'})]);const response=await run('Наличие 11054DEK');assert.match(response!.message,/снимок каталога/);assert.doesNotMatch(response!.message,/сейчас|данные API/);
});
test('no certificate links means unavailable API evidence, not absent certificate', async () => {
 const { run }=harness();for(const locale of ['ru','kk'] as const){const response=await run('Сертификат 11054DEK',[],locale);assert.match(response!.message,locale==='ru'?/Это не означает, что сертификата нет/:/сертификат жоқ дегенді білдірмейді/);}
});
test('unknown exact article does not use unrelated search candidate', async () => {
 const {run}=harness();const response=await run('Наличие 99999999',[shown()]);assert.equal(response?.products.length,0);assert.match(response!.message,/Точное совпадение/);
});
test('new product request must not adopt previously viewed item', async () => {
 const {run}=harness();const response=await run('Добавь кабель 3х2,5, 2 шт',[shown()]);assert.equal(response?.proposedItems,undefined);assert.equal(response?.products.length,0);
});
test('price cap excludes higher-priced target from proposals', async () => {
 const {run}=harness();const response=await run('Добавь 2 шт 11054DEK. Бюджет: до 100 тенге за единицу');assert.equal(response?.proposedItems,undefined);assert.equal(response?.products.length,0);assert.match(response!.message,/выше выбранного бюджета/);
});
test('low stock and minimum lot prevent invalid proposal', async () => {
 const low=harness([product('10001',{stock:1})]);assert.equal((await low.run('Добавь 2 шт 11054DEK'))?.proposedItems,undefined);const bulk=harness([product('10001',{specs:{KRATNOST_MIN:'5'}})]);assert.equal((await bulk.run('Добавь 2 шт 11054DEK'))?.proposedItems,undefined);assert.deepEqual((await bulk.run('Добавь 5 шт 11054DEK'))?.proposedItems,[{productId:'10001',quantity:5}]);
});
test('invalid current quantity never falls back to an older valid quantity', async () => {
 const {run}=harness();const history:ChatMessage[]=[{role:'user',content:'Добавь 2 шт 11054DEK'},shown()];for(const text of ['Добавь 0 шт','Добавь -3 шт','Добавь 2 шт и 5 шт'])assert.equal((await run(text,history))?.proposedItems,undefined,text);
});
test('ordinal reply completes a pending product choice and preserves requested quantity', async () => {
 const {run}=harness();const response=await run('второй',[{role:'user',content:'Добавь 2 шт'},{role:'assistant',content:'Какой именно товар вы имеете в виду?',productIds:['10001','10002']}]);assert.deepEqual(response?.proposedItems,[{productId:'10002',quantity:2}]);
});
test('quantity-only reply after one item uses it; multiple items require selection', async () => {
 const {run}=harness();assert.deepEqual((await run('2 шт',[shown()]))?.proposedItems,[{productId:'10001',quantity:2}]);const ambiguous=await run('2 шт',[shown(['10001','10002'])]);assert.equal(ambiguous?.proposedItems,undefined);assert.match(ambiguous!.message,/Какой именно товар/);
});
test('manager handoff explains manual send without claiming delivery', async () => {
 const {run}=harness();const response=await run('Свяжи меня с менеджером');assert.match(response!.message,/Связаться с менеджером/);assert.match(response!.message,/ручной отправки/);assert.equal(response?.proposedItems,undefined);
});
test('related intent with exact SKU returns supplied hydrated accessories and safety notice', async () => {
 const {run,catalog}=harness();let requested='';const accessory=product('10003',{name:'Бирка кабельная',source:'live'});catalog.getRelatedProducts=async id=>{requested=id;return{baseProductId:id,items:[{product:accessory,reason:{ru:'Для обозначения кабелей. Размер проверьте отдельно.',kk:'Кабельдерді белгілеуге арналған. Өлшемін бөлек тексеріңіз.'},basis:'category-rule',sourceUrl:accessory.url}],notice:{ru:'Идеи для проекта, а не подтверждённый совместимый комплект.',kk:'Жобаға арналған ұсыныстар, үйлесімділігі расталған жиынтық емес.'}};};
 const response=await run('Что нужно вместе с 11054DEK?');assert.equal(requested,'10001');assert.deepEqual(response?.products.map(p=>p.id),['10003']);assert.match(response!.message,/Для обозначения кабелей/);assert.match(response!.message,/не подтверждённый совместимый комплект/);assert.equal(response?.proposedItems,undefined);assert.equal(response?.mode,'catalog');
});
test('related intent supports unique context in Kazakh and never guesses among several products', async () => {
 const {run,catalog}=harness();let calls=0;catalog.getRelatedProducts=async id=>{calls++;return{baseProductId:id,items:[],notice:{ru:'Совместимость не подтверждена.',kk:'Үйлесімділігі расталмаған.'}};};const result=await run('Бірге не қажет?',[shown()],'kk');assert.match(result!.message,/Үйлесімділігі расталмаған/);assert.equal(calls,1);const ambiguous=await run('Сопутствующие товары',[shown(['10001','10002'])]);assert.match(ambiguous!.message,/Какой именно товар/);assert.equal(calls,1);
});
test('availability query for exact SKU includes known key specs and existing certificate source', async () => {
 const source='https://ekt.kz/upload/certificate.pdf';const {run}=harness([product('10001',{certificates:[{name:'Сертификат EKT',url:source}]})]);const response=await run('Есть артикул 11054DEK?');assert.match(response!.message,/Остаток: 10/);assert.match(response!.message,/Номинальный ток: 16 А/);assert.match(response!.message,/Количество полюсов: 1/);assert.match(response!.message,/certificate\.pdf/);assert.ok(response?.sources.some(item=>item.url===source));
});
