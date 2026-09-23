'use client';

import { useEffect, useState } from 'react';
import type { Locale, Product } from '@/lib/types';
import { ProductImage } from './ProductCard';
import { money } from '@/lib/i18n';

type Related = { items: { product: Product; reason: Record<Locale, string> }[]; notice: Record<Locale, string> };
export default function RelatedProducts({ productId, locale, onDetails }: { productId: string; locale: Locale; onDetails: (product: Product) => void }) {
  const [result, setResult] = useState<Related | null>(null);
  useEffect(() => {
    setResult(null); const controller = new AbortController();
    void fetch(`/api/products/${encodeURIComponent(productId)}/related?limit=3`, { signal: controller.signal }).then(async response => { if (response.ok) { const data = await response.json(); if (!controller.signal.aborted) setResult(data); } }).catch(() => { /* Optional suggestions must not block the product view. */ });
    return () => controller.abort();
  }, [productId]);
  if (!result?.items.length) return null;
  return <section className="detail-section"><h3>{locale === 'ru' ? 'Может пригодиться' : 'Қажет болуы мүмкін'}</h3><div className="related-products">{result.items.map(({ product, reason }) => <button key={product.id} className="related-product" onClick={() => onDetails(product)}><ProductImage product={product} /><strong>{product.name}</strong><span>{reason[locale]}</span><b>{money(product.price, locale)}</b></button>)}</div><p className="small-note">{result.notice[locale]}</p></section>;
}
