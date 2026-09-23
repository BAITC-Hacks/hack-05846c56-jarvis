import snapshot from '../../data/catalog-snapshot.json';
import index from '../../data/catalog-index.json';
import { allProducts, getProduct, searchLocal } from './catalog';
import type { Product } from './types';

export type RelatedReason = { ru: string; kk: string };
export interface RelatedItem {
  product: Product;
  reason: RelatedReason;
  basis: 'catalog-recommendation' | 'category-rule';
  sourceUrl: string;
}
export interface RelatedResponse {
  baseProductId: string;
  items: RelatedItem[];
  notice: RelatedReason;
}

type Kind = 'label' | 'tie' | 'tape' | 'enclosure';
type Resolver = (id: string, options?: { fresh?: boolean }) => Promise<Product | null>;
type RawProduct = { id: number | string; properties?: Record<string, unknown> };
const rawById = new Map<string, RawProduct>((snapshot.items as RawProduct[]).map(product => [String(product.id), product]));
const notice: RelatedReason = {
  ru: 'Сопутствующие товары — идеи для проекта, а не подтверждённый совместимый комплект. Проверьте размеры, условия применения и наличие по дате карточки. Добавление в корзину — только после вашего подтверждения.',
  kk: 'Қосымша тауарлар — жобаға арналған ұсыныстар, үйлесімділігі расталған жиынтық емес. Өлшемдерді, қолдану шарттарын және карточка күніндегі қорды тексеріңіз. Себетке тек сіз растағаннан кейін қосылады.',
};
const reasons: Record<Kind, RelatedReason> = {
  label: {
    ru: 'Для обозначения кабелей и цепей при организации проекта. Проверьте размер бирки, способ крепления и условия эксплуатации; электрическая совместимость не заявляется.',
    kk: 'Жоба кабельдері мен тізбектерін белгілеуге арналған. Бирка өлшемін, бекіту тәсілін және пайдалану шарттарын тексеріңіз; электрлік үйлесімділік мәлімделмейді.',
  },
  tie: {
    ru: 'Для организации и фиксации проводов. Диаметр пучка, допустимую нагрузку, температуру и стойкость к УФ необходимо подобрать отдельно.',
    kk: 'Сымдарды реттеу және бекіту үшін. Сымдар шоғының диаметрін, рұқсат етілген жүктемені, температураны және УК-ға төзімділікті бөлек таңдау қажет.',
  },
  tape: {
    ru: 'Расходный материал для монтажных работ. Проверьте назначение ленты, напряжение и температурный диапазон; она не заменяет предусмотренные проектом соединения и изоляцию.',
    kk: 'Монтаж жұмыстарына арналған шығын материалы. Таспаның мақсатын, кернеуі мен температура ауқымын тексеріңіз; ол жобада көзделген қосылыстар мен оқшаулауды алмастырмайды.',
  },
  enclosure: {
    ru: 'Пустой корпус для рассмотрения при проектировании щита. Размещение этого аппарата не подтверждено: проверьте габариты, крепление, степень защиты и тепловой расчёт.',
    kk: 'Қалқанды жобалау кезінде қарастыруға болатын бос корпус. Бұл аппаратты орналастыру мүмкіндігі расталмаған: өлшемін, бекітілуін, қорғаныс дәрежесін және жылу есебін тексеріңіз.',
  },
};

export function isEktSource(url: string): boolean {
  try { const parsed = new URL(url); return ['https:', 'http:'].includes(parsed.protocol) && (parsed.hostname === 'ekt.kz' || parsed.hostname.endsWith('.ekt.kz')); }
  catch { return false; }
}

/** RECOMMEND IDs are sourced metadata; they do not establish compatibility. */
export function catalogRecommendationIds(productId: string): string[] {
  const raw = rawById.get(productId)?.properties?.RECOMMEND;
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.map(String).filter(value => /^\d{1,12}$/.test(value)))].slice(0, 8);
}

function productKind(product: Pick<Product, 'name'>): Kind | null {
  const name = product.name.toLowerCase();
  // Deliberately exclude terminals, cable conductors and equipped switchboards:
  // the source's recommendations for 515291 include 32 A and 25 A equipment.
  if (/бирк[аиу]\b|бирк[аиу]\s|маркер\s+(?:кабел|провод)|маркировочн\w*\s+бирк/u.test(name)) return 'label';
  if (/стяжк[аи]\s+(?:нейлон|кабель|пластик)|хомут\s+(?:нейлон|кабель|пластик)/u.test(name) && !/площадк|инструмент|монтажный пистолет/u.test(name)) return 'tie';
  if (/изолент/u.test(name)) return 'tape';
  if ((/корпус|щмп/u.test(name)) && /металл|щит|монтажн/u.test(name) && !/укомплект|в сборе|комплектн|с автомат|счетчик|счётчик|щит учета|щит учёта/u.test(name)) return 'enclosure';
  return null;
}

function allowedKinds(base: Product): Kind[] {
  if (base.category === 'Кабель и провод') return ['label', 'tie', 'tape'];
  if (base.category === 'Автоматы и защита') return base.specs['Проверка данных'] ? ['label', 'tie'] : ['label', 'tie', 'enclosure'];
  return [];
}

/** Pure selection after hydration. No inferred stock from the lightweight index. */
export function selectRelatedProducts(base: Product, hydrated: Product[], recommendedIds: string[] = [], limit = 3): RelatedItem[] {
  const kinds = allowedKinds(base);
  const recommended = new Set(recommendedIds);
  const seen = new Set<string>();
  const candidates = hydrated.filter(product => {
    if (seen.has(product.id)) return false;
    seen.add(product.id);
    const kind = productKind(product);
    return product.id !== base.id && product.source !== 'demo' && product.stock > 0 && !!product.name && isEktSource(product.url) && !Number.isNaN(Date.parse(product.fetchedAt)) && !product.specs['Проверка данных'] && !!kind && (kinds.includes(kind) || (!kinds.length && recommended.has(product.id) && kind === 'label'));
  }).map(product => {
    const kind = productKind(product)!;
    const explicit = recommended.has(product.id) && isEktSource(base.url);
    return {
      kind,
      item: {
        product,
        basis: explicit ? 'catalog-recommendation' as const : 'category-rule' as const,
        sourceUrl: explicit ? base.url : product.url,
        reason: explicit ? {
          ru: 'Указан в списке RECOMMEND исходной карточки EKT. ' + reasons[kind].ru,
          kk: 'EKT бастапқы карточкасының RECOMMEND тізімінде көрсетілген. ' + reasons[kind].kk,
        } : reasons[kind],
      },
    };
  });
  candidates.sort((a, b) => Number(b.item.basis === 'catalog-recommendation') - Number(a.item.basis === 'catalog-recommendation'));
  const count = Math.max(1, Math.min(4, Math.floor(Number.isFinite(limit) ? limit : 3)));
  const result: RelatedItem[] = [];
  const selectedKinds = new Set<Kind>();
  // Prefer a useful variety of accessory types instead of three tape colours.
  for (const candidate of candidates) {
    if (selectedKinds.has(candidate.kind)) continue;
    result.push(candidate.item); selectedKinds.add(candidate.kind);
    if (result.length === count) return result;
  }
  for (const candidate of candidates) {
    if (result.some(item => item.product.id === candidate.item.product.id)) continue;
    result.push(candidate.item);
    if (result.length === count) break;
  }
  return result;
}

/** Resolver argument makes source hydration/error handling testable offline. */
export async function getRelatedProducts(idOrSku: string, limit = 3, resolve: Resolver = getProduct): Promise<RelatedResponse | null> {
  const input = idOrSku.trim();
  if (!input || input.length > 80 || /[\u0000-\u001f\/\\]/.test(input)) return null;
  let id = input;
  if (!/^\d{1,12}$/.test(id)) {
    const exact = searchLocal(input, { limit: 1 })[0];
    if (!exact || ![exact.sku, exact.specs.ARTIKULPOSTAVSHCHIKA].some(value => value?.toLowerCase() === input.toLowerCase())) return null;
    id = exact.id;
  }
  const base = await resolve(id);
  if (!base || !isEktSource(base.url)) return null;
  const explicitIds = catalogRecommendationIds(base.id);
  const kinds = allowedKinds(base);
  const local = allProducts();
  const selected = new Set<string>();
  // At most 4 candidates per kind plus the explicit metadata list are hydrated.
  for (const kind of kinds) {
    const detailed = local.filter(product => product.stock > 0 && productKind(product) === kind);
    // Lightweight index contributes IDs only, never its absent stock/properties.
    const indexedIds = index.items.filter(product => productKind(product) === kind).slice(0, 8).map(product => String(product.id));
    const uniqueIds = [...new Set([...detailed.map(product => product.id), ...indexedIds])];
    for (const productId of uniqueIds.slice(0, 4)) selected.add(productId);
  }
  for (const explicitId of explicitIds) selected.add(explicitId);
  selected.delete(base.id);
  const hydrated = await Promise.all([...selected].map(async candidateId => {
    try { return await resolve(candidateId, { fresh: true }); } catch { return null; }
  }));
  return { baseProductId: base.id, items: selectRelatedProducts(base, hydrated.filter((product): product is Product => !!product), explicitIds, limit), notice };
}
