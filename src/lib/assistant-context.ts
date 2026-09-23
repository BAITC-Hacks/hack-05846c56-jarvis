import type { ChatMessage, Locale, Product } from './types';

export const hasCartRequest = (text: string) => /добав(?:ь|ьте|ить|ляем|ляй)|в\s+корзину|купить|приобрести|закажи|сатып\s+ал|аламын|алып\s+бер|бер[её]м|беру|себет(?:ке|іне)|қос(?:шы|ыңыз|айық|у)?(?:\s|$|[.!?])/i.test(text);
export const hasDetailRequest = (text: string) => /характерист|сертифик|остат|налич|цен[ауые]|стоит|стоимост|номинал|ампер|артикул|параметр|кратност|минимальн|партия|ең\s+аз|еселік|сипаттама|қалдық|баға|бағасы|қанша\s+тұрады|қойма|бар\s+ма|номиналды|тогы/i.test(text);
export const hasAnalogRequest = (text: string) => /аналог|замен|балама|ұқсас/i.test(text);
export const hasPronounReference = (text: string) => /(?:^|\s)(его|е[её]|него|нее|этот|этого|эту|этой|ему|их|они|он|она)(?=$|\s|[.,!?])|осы|оның|оны|соның|мына/i.test(text);
export const isQuantityQuestion = (text: string) => /сколько\s+(?:шт|штук|метр|м\b|единиц)|какое\s+количество|укажите\s+количество|қанша\s+(?:дана|м|метр|шт)|санын\s+(?:жазыңыз|көрсет)/i.test(text);
export const isAffirmation = (text: string) => /^(?:да|ага|хорошо|ок|okay|иә|ия|жарайды)(?:[\s,.!]|$)/i.test(text);
const quantityPattern = /(?:^|[^\p{L}\p{N}+\-])([0-9]+(?:[.,][0-9]+)?)\s*(шт(?:ук(?:и|а)?)?\.?|дана|метр(?:ов|а)?|м)(?=$|[\s,;.!?])/giu;
export const hasQuantityMention = (text: string) => /[+-]?\d+(?:[.,]\d+)?\s*(?:шт(?:ук(?:и|а)?)?\.?|дана|метр(?:ов|а)?|м)(?=$|[\s,;.!?])/iu.test(text);
export const isQuantityOnlyResponse = (text: string) => /^\s*[+-]?\d+(?:[.,]\d+)?\s*(?:шт(?:ук(?:и|а)?)?\.?|дана|метр(?:ов|а)?|м)[.!]?\s*$/iu.test(text);

/** Counts require explicit units, or a bare reply to an actual quantity question. */
export function explicitQuantity(text: string, allowBare = false): number | undefined {
 const matches = [...text.matchAll(quantityPattern)].map(m => Number(m[1].replace(',', '.')));
 if (matches.length === 1) return validQuantity(matches[0]);
 if (matches.length > 1) return undefined;
 const bare = text.trim().match(/^([0-9]+(?:[.,][0-9]+)?)[.!]?$/);
 if (allowBare && bare) return validQuantity(Number(bare[1].replace(',', '.')));
 // "добавь 2" is clear; 5+ digit numbers could be catalogue IDs and need a unit.
 const command = text.trim().match(/^(?:да[, ]+)?(?:добавь|добавьте|беру|берем|берём|қос|қосыңыз)\s+([0-9]{1,4})(?:\s+(?:пожалуйста|өтінемін))?[.!]?$/i);
 return command ? validQuantity(Number(command[1])) : undefined;
}
function validQuantity(value: number) { return Number.isFinite(value) && value > 0 && value <= 100000 ? value : undefined; }

/** Only references, never quantity, price or electrical ratings. Exact catalogue matching follows this step. */
export function referenceTokens(text: string): string[] {
 const cleaned = text.replace(quantityPattern, ' ').replace(/(?:до|от|бюджет(?:ім)?\s*:?)\s*[\d\s]+(?:[.,]\d+)?(?:\s*(?:тенге|теңге|₸|KZT))?/gi, ' ').replace(/\d+(?:[.,]\d+)?\s*(?:тенге|теңге(?:ге)?|₸|KZT|вольт|ампер|ватт|кВт|кВ|мм2|мм²)(?=$|\s|[.,!?])/gi, ' ');
 const tokens = cleaned.match(/[\p{L}\p{N}][\p{L}\p{N}_./-]*/gu) || [];
 return [...new Set(tokens.map(t => t.replace(/[.,;!?]+$/, '')).filter(t => {
  if (!/\d/.test(t) || t.length > 80) return false;
  if (/^(?:ip\d+|[bcdсвд]\d+|\d+(?:[.,]\d+)?(?:a|а|v|в|w|вт|ka|ка|кв|к|p|р|ф)|\d+[xх×]\d+(?:[.,]\d+)?)$/i.test(t)) return false;
  return /^\d{5,12}_?$/.test(t) || (/\p{L}/u.test(t) && /\d{3}/.test(t));
 }))].slice(0, 4);
}

export function recentProductIds(messages: ChatMessage[], supplied: string[] = []): string[] {
 const recent = [...messages].reverse().find(m => m.role === 'assistant' && m.productIds?.length);
 return [...new Set(recent?.productIds || supplied)].slice(0, 12);
}
export function ordinalReference(text: string, count: number): number | undefined {
 if (/(?:^|\s)(?:перв(?:ый|ого|ую|ая)|бірінш\S*)(?=$|\s|[.,!?])/i.test(text)) return 0;
 if (/(?:^|\s)(?:втор(?:ой|ого|ую|ая)|екінш\S*)(?=$|\s|[.,!?])/i.test(text)) return 1;
 if (/(?:^|\s)(?:трет(?:ий|ьего|ью|ья)|үшінш\S*)(?=$|\s|[.,!?])/i.test(text)) return 2;
 if (/последн(?:ий|его|юю)|соңғы/i.test(text)) return count - 1;
 return undefined;
}
export function previousUserMessage(messages: ChatMessage[]): ChatMessage | undefined {
 const users = messages.filter(m => m.role === 'user');
 return users.length > 1 ? users[users.length - 2] : undefined;
}
export function priorQuantity(messages: ChatMessage[], target: Product): number | undefined {
 const previous = previousUserMessage(messages);
 if (!previous) return undefined;
 const refs = referenceTokens(previous.content);
 if (refs.length && !refs.some(ref => matchesReference(target, ref))) return undefined;
 // Reuse only an explicit purchase/count request from the immediately previous user turn.
 const quantityOnly = /^\s*\d+(?:[.,]\d+)?\s*(?:шт\.?|штук|дана|метр(?:ов|а)?|м)[.!]?\s*$/i.test(previous.content);
 const latestAssistant = [...messages].reverse().find(message => message.role === 'assistant');
 const sameTarget = latestAssistant?.productIds?.length === 1 && latestAssistant.productIds[0] === target.id;
 if (!hasCartRequest(previous.content) && !/нуж(?:ен|на|но|ны)|хочу|керек|алғым/i.test(previous.content) && !(quantityOnly && sameTarget)) return undefined;
 return explicitQuantity(previous.content);
}
export function matchesReference(product: Product, reference: string): boolean {
 const normalized = reference.toLowerCase().replace(/_$/, '');
 return [product.id, product.sku, product.specs.ARTIKULPOSTAVSHCHIKA, product.name.split(/\s/)[0]].some(v => v?.toLowerCase().replace(/_$/, '') === normalized);
}
export function localizedConflict(text: string, locale: Locale): string {
 if (locale === 'ru') return text;
 return text.replace('Противоречие источника:', 'Дереккөзде қайшылық бар:').replaceAll('жил в названии', 'атауындағы өзек саны').replaceAll('сечение в названии', 'атауындағы қима').replaceAll('в названии', 'атауында').replaceAll('в свойствах', 'сипаттамаларында').replaceAll('полюса', 'полюс').replace('Совместимость необходимо уточнить у менеджера.', 'Үйлесімділікті менеджерден нақтылау қажет.').replace('Нужна проверка менеджера.', 'Менеджердің тексеруі қажет.');
}
