'use client';
import Image from 'next/image';
import { ArrowUpRight, Box, Check, GitCompareArrows, Plus } from 'lucide-react';
import { useState } from 'react';
import { copy, money } from '@/lib/i18n';
import type { Locale, Product } from '@/lib/types';

export function ProductImage({ product, className = '' }: { product: Product; className?: string }) {
  const [failed, setFailed] = useState(false);
  return <div className={`product-image ${className}`}>{product.image && !failed ? <Image src={product.image} alt={product.name} width={360} height={280} unoptimized onError={() => setFailed(true)} /> : <Box size={52} strokeWidth={1} aria-hidden="true" />}</div>;
}

export default function ProductCard({ product, locale, onDetails, onAdd, onCompare, compared = false }: { product: Product; locale: Locale; onDetails: (product: Product) => void; onAdd: (product: Product) => void; onCompare?: (product: Product) => void; compared?: boolean }) {
  const t = copy[locale];
  return <article className="product-card">
    <div className="product-visual"><button className="product-image-button" aria-label={`${t.details}: ${product.name}`} onClick={() => onDetails(product)}><ProductImage product={product} /></button>{onCompare && <button className={`compare-button icon-button ${compared ? 'is-selected' : ''}`} title={compared ? t.removeCompare : t.compare} aria-label={`${compared ? t.removeCompare : t.compare}: ${product.name}`} aria-pressed={compared} onClick={() => onCompare(product)}>{compared ? <Check size={17} /> : <GitCompareArrows size={17} />}</button>}<span className="product-brand">{product.brand || 'EKT'}</span></div>
    <div className="product-body"><span className="product-sku">{t.sku} {product.sku || product.id}</span><button className="product-name" onClick={() => onDetails(product)}>{product.name}</button><div className={`stock ${product.stock > 0 ? '' : 'no-stock'}`}><i />{product.stock > 0 ? `${t.inStock} · ${product.stock} ${product.unit}` : t.unavailable}</div><div className="product-bottom"><strong>{money(product.price, locale)}{product.price !== null && <small> / {product.unit}</small>}</strong><button className="add-button" disabled={product.stock <= 0} aria-label={`${t.add}: ${product.name}`} onClick={() => onAdd(product)}><Plus size={18} /></button></div><div className="product-source" title={`${t.updated}: ${new Date(product.fetchedAt).toLocaleString(locale === 'kk' ? 'kk-KZ' : 'ru-KZ')}`}><span>{product.source === 'live' ? t.live : product.source === 'snapshot' ? t.snapshot : t.demo}<time dateTime={product.fetchedAt}>{new Date(product.fetchedAt).toLocaleDateString(locale === 'kk' ? 'kk-KZ' : 'ru-KZ', { day: '2-digit', month: '2-digit' })} · {new Date(product.fetchedAt).toLocaleTimeString(locale === 'kk' ? 'kk-KZ' : 'ru-KZ', { hour: '2-digit', minute: '2-digit' })}</time></span><button onClick={() => onDetails(product)} aria-label={t.details}><ArrowUpRight size={14} /></button></div></div>
  </article>;
}

