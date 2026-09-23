import type { Product } from './types';

export interface VisualEvidence {
  kind: 'breaker' | 'cable' | 'socket' | 'lighting' | 'other' | 'unknown';
  description: string;
  brand: string;
  model: string;
  markings: string[];
  uncertain: string;
}

const compact = (value: string) => value.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
// Visual retrieval is deliberately stricter than text search. Similar pictures are not identity evidence.
export function matchesVisualEvidence(product: Product, evidence: VisualEvidence): boolean {
  if (evidence.kind === 'unknown') return false;
  const categories: Partial<Record<VisualEvidence['kind'], string>> = {
    breaker: 'Автоматы и защита', cable: 'Кабель и провод',
    socket: 'Розетки и выключатели', lighting: 'Освещение',
  };
  if (categories[evidence.kind] && product.category !== categories[evidence.kind]) return false;
  const identity = compact(`${product.name} ${product.brand} ${product.sku} ${product.specs.ARTIKULPOSTAVSHCHIKA || ''}`);
  const brand = compact(evidence.brand).replace('schneiderelectric', 'schnel');
  if (brand && !identity.replace('schneiderelectric', 'schnel').includes(brand)) return false;
  if (evidence.model && !identity.includes(compact(evidence.model))) return false;
  const current = evidence.markings.join(' ').match(/(?:^|[^\d.])(\d+(?:[.,]\d+)?)\s*[AА](?![a-zа-я])/i)?.[1]?.replace(',', '.');
  if (current) {
    const ratings = `${product.name} ${product.specs.NOMINALNYY_TOK || ''}`;
    const amps = [...ratings.matchAll(/(?:^|[^\d.])(\d+(?:[.,]\d+)?)\s*[AА](?![a-zа-я])/gi)].map(match => match[1].replace(',', '.'));
    if (!amps.includes(current)) return false;
  }
  // Without a recognizable type or marking, do not suggest a random catalog item.
  return evidence.kind !== 'other' || Boolean(evidence.model || brand);
}

export function exactProductReference(product: Product, query: string): boolean {
  const normalized = query.trim().toLowerCase().replace(/_$/, '');
  return [product.id, product.sku, product.specs.ARTIKULPOSTAVSHCHIKA, product.name.split(/\s/)[0]]
    .some(value => value?.toLowerCase().replace(/_$/, '') === normalized);
}

export function comparisonRows(products: Product[]) {
  const keys = [...new Set(products.flatMap(product => Object.keys(product.specs).filter(key => /[А-Яа-я]/.test(key))))];
  return keys.map(key => ({ key, values: products.map(product => product.specs[key] || '—'),
    different: new Set(products.map(product => product.specs[key] || '—')).size > 1 }));
}
