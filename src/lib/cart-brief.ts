import type { Cart, Locale } from './types';
import { money } from './i18n';

export function cartBrief(cart: Cart, locale: Locale): string {
  const kk = locale === 'kk';
  const lines = ['JARVIS · EKT', kk ? 'Менеджерге арналған тауарлар тізімі' : 'Подборка товаров для менеджера', new Date(cart.updatedAt).toISOString(), ''];
  cart.items.forEach(({ product: p, quantity }, index) => {
    lines.push(`${index + 1}. ${p.name}`, `${kk ? 'Артикул' : 'Артикул'}: ${p.sku} · ID: ${p.id}`, `${quantity} ${p.unit} × ${money(p.price, locale)} = ${money(p.price == null ? null : quantity * p.price, locale)}`, `${kk ? 'Қалдық' : 'Остаток'}: ${p.stock} ${p.unit} (${p.source}, ${p.fetchedAt})`, p.url);
    if (p.specs['Проверка данных']) lines.push('⚠ ' + p.specs['Проверка данных']);
    if (!p.certificates.length) lines.push(kk ? 'Сертификатты менеджерден сұрау қажет.' : 'Ссылки на сертификаты не получены; запросить у менеджера.');
    lines.push('');
  });
  lines.push(`${kk ? 'Белгілі бағалар бойынша жиыны' : 'Итого по известным ценам'}: ${money(cart.total, locale)}`);
  if (cart.items.some(line => line.product.price == null)) lines.push(kk ? 'Бағасы белгісіз позициялар жиынтыққа кірмейді.' : 'Позиции без цены в итог не включены.');
  lines.push('', kk ? 'Бағаны, қалдықты, жеткізуді және үйлесімділікті менеджермен нақтылаңыз. Тапсырыс жасалған жоқ, тауар резервтелмеген.' : 'Согласуйте с менеджером цены, остатки, доставку и совместимость. Заказ не оформлен, товары не зарезервированы.');
  return lines.join('\n');
}
