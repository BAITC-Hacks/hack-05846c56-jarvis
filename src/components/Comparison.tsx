'use client';
import { useState } from 'react';
import type { Locale, Product } from '@/lib/types';
import { comparisonRows } from '@/lib/evidence';
import { copy, money } from '@/lib/i18n';
import Modal from './Modal';
import { ProductImage } from './ProductCard';

export default function Comparison({ products, locale, onClose, onAdd }: { products: Product[]; locale: Locale; onClose: () => void; onAdd: (product: Product) => void }) {
  const [differencesOnly, setDifferencesOnly] = useState(false);
  const kk = locale === 'kk'; const t = copy[locale];
  const rows = comparisonRows(products).filter(row => !differencesOnly || row.different);
  return <Modal wide title={kk ? 'Тауарларды салыстыру' : 'Сравнение товаров'} closeLabel={t.close} onClose={onClose}>
    <p className="modal-description">{kk ? 'Каталог деректері. Сипаттамалардың сәйкес келуі орнату үйлесімділігін растамайды.' : 'Данные каталога. Совпадение характеристик не подтверждает совместимость при установке.'}</p>
    <label className="comparison-toggle"><input type="checkbox" checked={differencesOnly} onChange={event => setDifferencesOnly(event.target.checked)} />{kk ? 'Тек айырмашылықтар' : 'Только отличия'}</label>
    <div className="comparison-scroll" tabIndex={0} role="region" aria-label={kk ? 'Салыстыру кестесі' : 'Таблица сравнения'}><table className="comparison-table"><thead><tr><th scope="col">{kk ? 'Сипаттама' : 'Характеристика'}</th>{products.map(product => <th key={product.id} scope="col"><ProductImage product={product} /><span>{product.name}</span></th>)}</tr></thead><tbody>
      <tr><th scope="row">{t.sku}</th>{products.map(product => <td key={product.id}>{product.sku}</td>)}</tr>
      <tr><th scope="row">{kk ? 'Бағасы' : 'Цена'}</th>{products.map(product => <td key={product.id}>{money(product.price, locale)} / {product.unit}</td>)}</tr>
      <tr><th scope="row">{kk ? 'Қалдық' : 'Остаток'}</th>{products.map(product => <td key={product.id}>{product.stock} {product.unit}</td>)}</tr>
      {rows.map(row => <tr key={row.key} className={row.different ? 'different' : ''}><th scope="row">{row.key}</th>{row.values.map((value, index) => <td key={products[index].id}>{value}</td>)}</tr>)}
      <tr><th scope="row">{t.source}</th>{products.map(product => <td key={product.id}><a href={product.url} target="_blank" rel="noopener noreferrer">{product.source === 'live' ? t.live : t.snapshot}</a><small>{new Date(product.fetchedAt).toLocaleString(kk ? 'kk-KZ' : 'ru-KZ')}</small></td>)}</tr>
      <tr><th scope="row">{t.cart}</th>{products.map(product => <td key={product.id}><button className="secondary-button" disabled={product.stock <= 0} onClick={() => { onClose(); onAdd(product); }}>{t.add}</button></td>)}</tr>
    </tbody></table></div>
  </Modal>;
}
