'use client';
import { useState } from 'react';
import type { Locale, SpecificationRow } from '@/lib/types';
import { money } from '@/lib/i18n';

export default function SpecificationReview({ rows, locale, busy, onPrepare }: {
  rows: SpecificationRow[]; locale: Locale; busy: boolean;
  onPrepare: (items: { productId: string; quantity: number }[]) => void;
}) {
  const kk = locale === 'kk';
  const [choices, setChoices] = useState(() => rows.map(row => ({ checked: false, id: row.exact ? row.products[0]?.id || '' : '', quantity: row.quantity?.toString() || '' })));
  const update = (index: number, values: Partial<typeof choices[number]>) => setChoices(current => current.map((choice, i) => i === index ? { ...choice, ...values } : choice));
  const items = choices.filter(choice => choice.checked).map(choice => ({ productId: choice.id, quantity: Number(choice.quantity) }));
  const merged = [...items.reduce((map, item) => map.set(item.productId, (map.get(item.productId) || 0) + item.quantity), new Map<string, number>())].map(([productId, quantity]) => ({ productId, quantity }));
  const valid = merged.length > 0 && merged.every(item => {
    const product = rows.flatMap(row => row.products).find(product => product.id === item.productId);
    const step = Math.max(Number(product?.specs.KRATNOST_MIN?.replace(',', '.') || 1), 0.000001);
    return product && product.price != null && Number.isFinite(item.quantity) && item.quantity >= step && item.quantity <= product.stock && Math.abs(item.quantity / step - Math.round(item.quantity / step)) < 0.000001;
  });
  return <section className="spec-review" aria-label={kk ? 'Спецификацияны тексеру' : 'Проверка спецификации'}>
    {rows.map((row, index) => {
      const choice = choices[index]; const product = row.products.find(product => product.id === choice.id);
      return <div className="spec-review-row" key={index}>
        <label className="spec-review-choice"><input type="checkbox" checked={choice.checked} disabled={!row.products.length || busy} onChange={event => update(index, { checked: event.target.checked })} /><strong>{index + 1}. {row.label}</strong></label>
        <span className={`spec-match ${row.exact ? 'exact' : ''}`}>{row.exact ? (kk ? 'Артикул сәйкес келеді' : 'Артикул совпадает') : row.products.length ? (kk ? 'Үміткерді таңдаңыз' : 'Выберите кандидата') : (kk ? 'Табылмады — артикулды нақтылаңыз' : 'Не найдено — уточните артикул')}</span>
        {!!row.products.length && <div className="spec-review-fields"><label><span>{kk ? 'Тауар' : 'Товар'}</span><select value={choice.id} disabled={busy} onChange={event => update(index, { id: event.target.value })}><option value="">{kk ? 'Таңдау…' : 'Выбрать…'}</option>{row.products.map(product => <option key={product.id} value={product.id}>{product.name} · {money(product.price, locale)}</option>)}</select></label><label><span>{kk ? 'Саны' : 'Количество'}{product ? ` (${product.unit})` : ''}</span><input type="number" min={product?.specs.KRATNOST_MIN || 1} step={product?.specs.KRATNOST_MIN || 1} value={choice.quantity} disabled={busy} onChange={event => update(index, { quantity: event.target.value })} /></label></div>}
        {product && <><strong className="spec-product-name">{product.name}</strong><p className="small-note">{kk ? 'Қалдық' : 'Остаток'}: {product.stock} {product.unit} · {product.source === 'live' ? (kk ? 'Қазір тексерілді' : 'Проверено сейчас') : (kk ? 'Каталог көшірмесі' : 'Снимок каталога')} · <a href={product.url} target="_blank" rel="noopener noreferrer">{kk ? 'Дереккөз' : 'Источник'}</a>{product.specs['Проверка данных'] && <span className="spec-conflict">{product.specs['Проверка данных']}</span>}</p></>}
      </div>;
    })}
    <p className="small-note">{kk ? 'Қосу алдында қалдық пен баға қайта тексеріледі. Жарамды сан мен тауарды көрсетіңіз, содан кейін жолдарды белгілеңіз.' : 'Укажите товар и допустимое количество, затем отметьте строки. Перед добавлением цена и остаток будут перепроверены.'}</p>
    <button className="primary-button" disabled={!valid || busy} onClick={() => onPrepare(merged)}>{kk ? 'Таңдалғандарды тексеру' : 'Проверить выбранные'}{items.length > 0 ? ` (${items.length})` : ''}</button>
  </section>;
}
