import type { ChatMessage, ChatResponse, Locale, Product } from './types';
import type { RelatedResponse } from './related';
import { explicitQuantity, hasAnalogRequest, hasCartRequest, hasDetailRequest, hasPronounReference, hasQuantityMention, isAffirmation, isQuantityQuestion, isQuantityOnlyResponse, localizedConflict, matchesReference, ordinalReference, priorQuantity, previousUserMessage, recentProductIds, referenceTokens } from './assistant-context';

export interface DeterministicInput { messages: ChatMessage[]; locale: Locale; contextProductIds?: string[]; text: string; maxPrice?: number; }
export interface AssistantCatalog {
 searchProducts(query: string, options?: { limit?: number; maxPrice?: number }): Promise<Product[]>;
 getProduct(id: string, options?: { fresh?: boolean }): Promise<Product | null>;
 getAnalogProducts(id: string, limit?: number): Promise<{ product: Product; reason: string; warnings: string[] }[]>;
 getRelatedProducts?(id: string, limit?: number): Promise<RelatedResponse | null>;
}
const dedupe = (items: Product[]) => [...new Map(items.map(p => [p.id, p])).values()];
const specLabels: [string, string, string][] = [
 ['NOMINALNYY_TOK','Номинальный ток','Номиналды ток'], ['KOLICHESTVO_POLYUSOV','Количество полюсов','Полюстер саны'],
 ['NOMINALNOE_NAPRYAZHENIE','Номинальное напряжение','Номиналды кернеу'], ['NOMINALNAYA_OTKLYUCHAYUSHCHAYA_SPOSOBNOST','Отключающая способность','Ажырату қабілеті'],
 ['KHARAKTERISTIKA_SRABATYVANIYA','Характеристика срабатывания','Іске қосылу сипаттамасы'], ['KOLICHESTVO_ZHIL','Количество жил','Өзектер саны'],
 ['SECHENIE_MM2','Сечение, мм²','Қима, мм²'], ['MATERIAL_ZHILY','Материал жилы','Өзек материалы'], ['KRATNOST_MIN','Минимальная кратность','Ең аз еселік'],
 ['MOSHCHNOST','Мощность','Қуат'], ['TSOKOL','Цоколь','Цоколь'], ['STEPEN_ZASHCHITY','Степень защиты','Қорғаныс дәрежесі'],
 ['SVETOVOY_POTOK','Световой поток','Жарық ағыны'], ['TSVETOVAYA_TEMPERATURA','Цветовая температура','Түс температурасы'],
 ['MATERIAL_IZOLYATSII_I_OBOLOCHKI','Изоляция и оболочка','Оқшаулау және қабық'], ['GIBKOST','Гибкость','Икемділік'],
 ['NAZNACHENIE','Назначение','Мақсаты'], ['TIP_USTANOVKI','Тип установки','Орнату түрі'],
 ['TORGOVAYA_MARKA','Бренд','Бренд']
];
function sourceText(product: Product, locale: Locale) {
 const stamp = Number.isNaN(Date.parse(product.fetchedAt)) ? product.fetchedAt : new Date(product.fetchedAt).toLocaleString(locale === 'kk' ? 'kk-KZ' : 'ru-RU', { timeZone: 'Asia/Almaty', hour12: false });
 return locale === 'kk' ? `${product.source === 'live' ? 'API дерегі' : product.source === 'demo' ? 'демо дерек' : 'каталог көшірмесі'}, ${stamp}` : `${product.source === 'live' ? 'данные API' : product.source === 'demo' ? 'демоданные' : 'снимок каталога'}, ${stamp}`;
}
function summary(product: Product, locale: Locale) {
 const kk = locale === 'kk';
 const price = product.price == null ? (kk ? 'бағасы нақтыланады' : 'цена уточняется') : `${product.price.toLocaleString('ru-RU')} ₸`;
 return `${product.name}\nАртикул: ${product.sku}. ${price}. ${kk ? 'Қалдық' : 'Остаток'}: ${product.stock} ${product.unit}.\n${sourceText(product, locale)}.`;
}
function certificateText(product: Product, locale: Locale) {
 return product.certificates.length ? (locale === 'kk' ? 'Сертификат сілтемелері:' : 'Ссылки на сертификаты:') + '\n' + product.certificates.map(c => `${c.name}: ${c.url}`).join('\n') : locale === 'kk' ? 'API сертификат сілтемелерін бермеді. Бұл сертификат жоқ дегенді білдірмейді; оны менеджерден сұраңыз.' : 'API не предоставил ссылки на сертификаты. Это не означает, что сертификата нет; запросите его у менеджера.';
}
function analogReason(reason: string, locale: Locale) {
 if (locale === 'ru') return reason;
 let translated = reason.replace('Совпадают:', 'Сәйкес келеді:');
 for (const [, ru, kk] of specLabels) translated = translated.replaceAll(ru, kk);
 return translated.replace('Гибкость', 'Икемділік').replace('Назначение', 'Мақсаты').replace('Изоляция и оболочка', 'Оқшаулау және қабық').replace('Металлическая броня', 'Металл бронь');
}

/** Fast catalogue operations with no LLM selection, no hidden cart mutation, and testable dependencies. */
export async function answerDeterministically(input: DeterministicInput, catalog: AssistantCatalog): Promise<ChatResponse | null> {
 const { text, locale, maxPrice } = input;
 const kk = locale === 'kk';
 const response: ChatResponse = { message: '', products: [], sources: [], suggestions: [], mode: 'catalog' };
 if (/менеджер|оператормен|оператор(?:а|ом)?|адаммен\s+сөйлес|тірі\s+кеңесші/i.test(text)) {
  response.message = kk ? 'Менеджермен байланысу батырмасын басып, қалаңызды таңдаңыз. Қоңырау шалуға немесе хатты ашып, өзіңіз жіберуге болады. Хабарлама автоматты түрде жіберілген жоқ.' : 'Нажмите «Связаться с менеджером» и выберите город. Можно позвонить или открыть письмо для ручной отправки. Сообщение автоматически не отправлялось.';
  return response;
 }
 const lastAssistant = [...input.messages].reverse().find(m => m.role === 'assistant');
 const askedQuantity = isQuantityQuestion(lastAssistant?.content || '');
 const quantity = explicitQuantity(text, askedQuantity);
 const references = referenceTokens(text);
 const ids = recentProductIds(input.messages, input.contextProductIds);
 const ordinal = ordinalReference(text, ids.length);
 const pronoun = hasPronounReference(text);
 const pendingProductChoice = /какой именно товар|қай тауар/i.test(lastAssistant?.content || '') && hasCartRequest(previousUserMessage(input.messages)?.content || '') && (ordinal != null || references.length === 1) && !hasDetailRequest(text) && !hasAnalogRequest(text);
 const cart = hasCartRequest(text) || (askedQuantity && /^\s*[+-]?\d/.test(text)) || (ids.length > 0 && isQuantityOnlyResponse(text)) || pendingProductChoice || (isAffirmation(text) && /подготов|добав|растау|қосу|себет/i.test(lastAssistant?.content || ''));
 const analog = hasAnalogRequest(text);
 const related = /сопутств|аксессуар|что\s+(?:ещ[её]\s+)?(?:нужно|купить|взять|понадобится)[\s\S]{0,40}вместе|вместе\s+с|қосымша\s+тауар|керек-жарақ|бірге\s+(?:не|қандай)|не\s+қажет/i.test(text);
 const detail = hasDetailRequest(text);
 const namesNewProduct = /автомат|кабел|розетк|светильник|ажыратқыш|сым|шам/i.test(text) && !pronoun && ordinal == null;
 const contextFollowup = (pronoun || ordinal != null || cart || detail || analog || related) && ids.length > 0 && !namesNewProduct;
 if (!references.length && !cart && !detail && !analog && !related && !contextFollowup) return null;
 if (/(?:не\s+(?:добав|покуп|клади|нужно)|қоспа|алмаймын)/i.test(text)) {
  response.message = kk ? 'Тауар себетке қосылмады. Басқа тауар немесе сипаттама бойынша көмектесе аламын.' : 'Товар в корзину не добавлен. Могу помочь с другим товаром или характеристиками.';
  return response;
 }
 const withinBudget = (product: Product) => maxPrice == null || (product.price != null && product.price <= maxPrice);
 const finish = (products: Product[], message: string) => {
  response.products = dedupe(products).slice(0, 6);
  response.message = message;
  response.sources = [...new Map([...response.sources, ...response.products.map(p => ({ title: p.name, url: p.url })), ...response.products.flatMap(p => p.certificates.map(c => ({ title: c.name, url: c.url })))].map(source => [source.url, source])).values()].slice(0, 10);
  for (const warning of new Set(response.products.map(p => p.specs['Проверка данных']).filter(Boolean))) if(!response.message.includes(localizedConflict(warning, locale)))response.message += '\n⚠ ' + localizedConflict(warning, locale);
  return response;
 };
 const clarifyProduct = (products: Product[] = []) => finish(products, kk ? 'Қай тауарды айтып тұрсыз? Артикулын жазыңыз немесе тізімдегі бірінші, екінші тауарды көрсетіңіз.' : 'Какой именно товар вы имеете в виду? Напишите артикул или укажите первый, второй товар в списке.');
 let selected: Product | null = null;
 let candidates: Product[] = [];
 if (references.length) {
  const retrieved = await Promise.all(references.map(ref => catalog.searchProducts(ref, { limit: 4 })));
  candidates = dedupe(retrieved.flatMap((products, index) => products.filter(product => matchesReference(product, references[index]))));
  if (!candidates.length) {
   // An unknown model series is a search, while explicit SKU/id requests must not resolve to an unrelated product.
   const strictReference = references.some(ref => /^\d{5,12}_?$/.test(ref)) || /артикул|sku|код|id\s*[:№]/i.test(text);
   if (!strictReference && !cart && !detail && !analog && !related) return null;
   return finish([], kk ? 'Көрсетілген артикул бойынша дәл тауар табылмады. Кодты тексеріңіз немесе толық атауын жазыңыз.' : 'Точное совпадение по указанному артикулу не найдено. Проверьте код или напишите полное название.');
  }
  if (candidates.length === 1) selected = candidates[0];
 } else if (contextFollowup) {
  if (ordinal != null && (ordinal < 0 || ordinal >= ids.length)) return clarifyProduct();
  const targetId = ordinal != null ? ids[ordinal] : ids.length === 1 ? ids[0] : null;
  if (targetId) selected = await catalog.getProduct(targetId);
  else candidates = (await Promise.all(ids.slice(0, 6).map(id => catalog.getProduct(id)))).filter((p): p is Product => p != null);
 } else if (cart || detail || analog) {
  // Never adopt an old selection when the user starts asking about a different kind of product.
  if (namesNewProduct) candidates = await catalog.searchProducts(text, { limit: 6, maxPrice });
  if (candidates.length === 1) selected = candidates[0];
 }
 if (!selected) return clarifyProduct(candidates);
 const fresh = await catalog.getProduct(selected.id, { fresh: true });
 if (fresh) selected = fresh;
 response.sources.push({ title: selected.name, url: selected.url });
 if (related) {
  const relatedResult = await catalog.getRelatedProducts?.(selected.id, 3);
  const items = relatedResult?.items.filter(item => withinBudget(item.product)) || [];
  for (const item of items) response.sources.push({ title: item.product.name, url: item.sourceUrl });
  const lead = kk ? `«${selected.name}» үшін жобаға арналған қосымша ұсыныстар:` : `Сопутствующие идеи для проекта с «${selected.name}»:`;
  const content = items.length ? '\n\n' + items.map((item, i) => `${i + 1}. ${item.product.name}\n${item.reason[locale]}\n${sourceText(item.product, locale)}.`).join('\n\n') : kk ? '\nОсы тауарға дәлелді қосымша ұсыныс табылмады.' : '\nДля этого товара обоснованных сопутствующих предложений не найдено.';
  const warning = relatedResult?.notice[locale] || (kk ? 'Үйлесімділігі расталмаған. Өлшемдер мен қолдану шарттарын бөлек тексеру қажет.' : 'Совместимость не подтверждена. Размеры и условия применения необходимо проверить отдельно.');
  let message = lead + content + '\n\n' + warning;
  if (selected.specs['Проверка данных']) message += '\n⚠ ' + localizedConflict(selected.specs['Проверка данных'], locale);
  return finish(items.map(item => item.product), message);
 }
 if (!withinBudget(selected) && !analog && selected.stock > 0) return finish([], kk ? 'Бұл тауардың бағасы белгіленген бюджеттен жоғары немесе баға нақтыланбаған. Бюджетті өзгертіңіз не арзанырақ балама сұраңыз.' : 'Цена этого товара выше выбранного бюджета либо не подтверждена. Измените бюджет или попросите более доступный аналог.');

 const offerAnalogs = async (base: Product, lead: string, preserveBase: boolean) => {
  const alternatives = (await catalog.getAnalogProducts(base.id, 4)).filter(item => item.product.stock > 0 && withinBudget(item.product));
  const explanation = alternatives.length ? (kk ? '\n\nНегізгі сипаттамалары сәйкес балама үміткерлер:\n' : '\n\nКандидаты на замену с совпадающими критическими характеристиками:\n') + alternatives.map((item, i) => `${i + 1}. ${item.product.name}\n${analogReason(item.reason, locale)}\n${kk ? 'Қалдық' : 'Остаток'}: ${item.product.stock} ${item.product.unit} (${sourceText(item.product, locale)}).`).join('\n\n') + (kk ? '\nОрнату, өлшемдер және қолдану шарттарын маманмен тексеріңіз. Қай нұсқаны таңдайсыз?' : '\nМонтаж, габариты и условия эксплуатации проверьте со специалистом. Какой вариант выбираете?') : (kk ? '\nНегізгі сипаттамалары толық сәйкес, қолжетімді балама табылмады. Техникалық параметрлерді өзгертіп алмастыруға болмайды.' : '\nДоступный аналог с полным совпадением критических характеристик не найден. Нельзя заменять устройство с изменением номиналов.');
  response.suggestions = alternatives.length ? (kk ? ['Бірінші баламаның сипаттамалары', 'Сертификат бар ма?'] : ['Характеристики первого аналога', 'Есть ли сертификат?']) : [];
  // Cards follow the numbered alternatives; the unavailable original remains cited, avoiding an off-by-one choice.
  return finish(alternatives.length ? alternatives.map(item => item.product) : preserveBase ? [base] : [], lead + explanation);
 };
 let baseSummary = summary(selected, locale);
 const wantsSpecs = /характерист|параметр|номинал|ампер|сипаттама|тогы|кернеу|полюс|кратност|минимальн|партия|ең\s+аз|еселік/i.test(text);
 const wantsCertificates = /сертифик/i.test(text);
 if (wantsSpecs || references.length > 0) {
  const known = specLabels.filter(([key]) => selected!.specs[key]);
  const selectedSpecs = wantsSpecs ? known : known.filter(([key]) => !['KRATNOST_MIN', 'TORGOVAYA_MARKA'].includes(key)).slice(0, 4);
  const specs = selectedSpecs.map(([key, ru, kz]) => `${kk ? kz : ru}: ${selected!.specs[key]}`);
  baseSummary += specs.length ? '\n\n' + specs.join('\n') : kk ? '\nСипаттамалар API дерегінде берілмеген.' : '\nХарактеристики в данных API не предоставлены.';
 }
 if (/налич|остат|қалдық|қойма|бар\s+ма/i.test(text) && selected.warehouses.length) baseSummary += '\n\n' + (kk ? 'Қоймалар: ' : 'Склады: ') + selected.warehouses.slice(0, 6).map(warehouse => `${warehouse.name} — ${warehouse.stock} ${selected!.unit}`).join('; ') + '.';
 if (wantsCertificates || selected.certificates.length > 0) baseSummary += '\n\n' + certificateText(selected, locale);
 if(selected.specs['Проверка данных'])baseSummary+='\n⚠ '+localizedConflict(selected.specs['Проверка данных'],locale);

 if (analog) return offerAnalogs(selected, baseSummary, true);
 if (selected.stock <= 0) return offerAnalogs(selected, baseSummary + (kk ? '\nБұл тауар бойынша көрсетілген қалдық — 0; оны себетке қосуды ұсына алмаймын.' : '\nПо этому товару остаток 0; предложить добавление в корзину не могу.'), true);
 if (cart) {
  if (selected.price == null) return finish([selected], baseSummary + (kk ? '\nРастау ұсынысы үшін бағаны алдымен менеджерден нақтылау қажет.' : '\nЧтобы подготовить предложение, сначала нужно уточнить цену у менеджера.'));
  const suppliedInvalidQuantity = quantity == null && (hasQuantityMention(text) || (askedQuantity && /^\s*[+-]?\d/.test(text)));
  const amount = quantity ?? (suppliedInvalidQuantity ? undefined : priorQuantity(input.messages, selected));
  if (amount == null) {
   response.suggestions = kk ? ['2 дана', '5 дана'] : ['2 шт', '5 шт'];
   return finish([selected], baseSummary + (kk ? `\nҚанша ${selected.unit === 'м' ? 'метр' : 'дана'} қосу керек? Санын жазыңыз.` : `\nСколько ${selected.unit} добавить? Укажите количество.`));
  }
  const multiple = Number((selected.specs.KRATNOST_MIN || '1').replace(',', '.')) || 1;
  if ((selected.unit !== 'м' && !Number.isInteger(amount)) || Math.abs(amount / multiple - Math.round(amount / multiple)) > 1e-7) return finish([selected], baseSummary + (kk ? `\nСан тауардың ${multiple} ${selected.unit} еселігіне сәйкес болуы керек.` : `\nКоличество должно соответствовать кратности ${multiple} ${selected.unit}${selected.unit !== 'м' ? ' и быть целым' : ''}.`));
  if (amount > selected.stock) return offerAnalogs(selected, baseSummary + (kk ? `\nСұралған ${amount} ${selected.unit} үшін қалдық жеткіліксіз. Растауға жіберілген жоқ.` : `\nДля запрошенных ${amount} ${selected.unit} остатка недостаточно. Добавление не подготовлено.`), true);
  response.proposedItems = [{ productId: selected.id, quantity: amount }];
  return finish([selected], baseSummary + (kk ? `\n\n${amount} ${selected.unit} үшін ұсыныс дайын. Тауар әлі қосылған жоқ. Бөлек растау терезесінде баға мен қалдық қайта тексеріледі.` : `\n\nПодготовил предложение на ${amount} ${selected.unit}. Товар ещё не добавлен. Подтвердите в отдельном окне: цена и остаток будут перепроверены.`));
 }
 response.suggestions = kk ? ['Сипаттамаларын көрсет', 'Сертификат бар ма?', 'Себетке қос'] : ['Показать характеристики', 'Есть ли сертификат?', 'Добавить в корзину'];
 return finish([selected], baseSummary);
}
