import type { Locale } from '@/lib/types';
import './ekt-footer.css';

// Official category and buyer-service URLs verified against ekt.kz on 2026-09-23.
// Kazakh copy is our UI translation; commercial terms remain on the source pages.
export const ektMarqueeCopy: Record<Locale, [string, string]> = {
  ru: [
    'КАБЕЛЬ И ПРОВОД · НИЗКОВОЛЬТНАЯ АППАРАТУРА · СВЕТИЛЬНИКИ И ЛАМПЫ ·',
    'ШКАФЫ И ЩИТЫ · РОЗЕТКИ И ВЫКЛЮЧАТЕЛИ · АВТОМАТИЗАЦИЯ ·',
  ],
  kk: [
    'КАБЕЛЬ ЖӘНЕ СЫМ · ТӨМЕН КЕРНЕУЛІ АППАРАТУРА · ШАМДАР МЕН ШЫРАҒДАНДАР ·',
    'ШКАФТАР МЕН ҚАЛҚАНДАР · РОЗЕТКАЛАР МЕН ҚОСҚЫШТАР · АВТОМАТТАНДЫРУ ·',
  ],
};

const categories = [
  ['kabel_provod', 'Кабель и провод', 'Кабель және сым'],
  ['nizkovoltnaya_apparatura', 'Низковольтная аппаратура', 'Төмен кернеулі аппаратура'],
  ['svetilniki_lampy', 'Светильники и лампы', 'Шамдар мен шырағдандар'],
  ['shkafy_shchity', 'Шкафы и щиты', 'Шкафтар мен қалқандар'],
  ['rozetki_vyklyuchateli_korobki', 'Розетки, выключатели, коробки', 'Розеткалар, қосқыштар, қораптар'],
  ['avtomatizatsiya', 'Автоматизация', 'Автоматтандыру'],
] as const;

const buyerLinks = [
  ['/catalog/', 'Весь каталог EKT', 'EKT толық каталогы'],
  ['/checkout-delivery/', 'Доставка и оплата', 'Жеткізу және төлем'],
  ['/about/howto/', 'Как оформить заказ', 'Тапсырысты қалай рәсімдеу керек'],
  ['/about/contacts/', 'Магазины и контакты', 'Дүкендер мен байланыс'],
  ['/return/', 'Возврат и обмен', 'Қайтару және айырбастау'],
] as const;

export default function EktFooter({ locale }: { locale: Locale }) {
  const kk = locale === 'kk';
  const newTab = kk ? 'Жаңа қойындыда ашылады' : 'Откроется в новой вкладке';
  return (
    <footer className="ekt-footer" lang={locale}>
      <div className="ekt-footer__grid">
        <div className="ekt-footer__intro">
          <a className="ekt-footer__brand" href="https://ekt.kz/" target="_blank" rel="noopener noreferrer" aria-label={`EKT.kz — ${newTab}`}>
            <span>EKT<span className="ekt-footer__dot">.</span></span>
            <span className="ekt-footer__external" aria-hidden="true">↗</span>
          </a>
          <p>{kk ? 'EKT каталогынан электр жабдықтарын таңдауға арналған көмекші.' : 'Помощник в подборе электротехники по каталогу EKT.'}</p>
          <p className="ekt-footer__note">{kk ? 'Жеткізу, төлем және өзіңіз алып кету туралы өзекті ақпарат — EKT сайтында.' : 'Актуальная информация о доставке, оплате и самовывозе — на сайте EKT.'}</p>
        </div>
        <nav aria-label={kk ? 'EKT тауар санаттары' : 'Категории товаров EKT'}>
          <h2>{kk ? 'Каталог' : 'Каталог'}</h2>
          <ul>
            {categories.map(([slug, ru, kz]) => (
              <li key={slug}><a href={`https://ekt.kz/catalog/${slug}/`} target="_blank" rel="noopener noreferrer">{kk ? kz : ru}<span className="visually-hidden"> — {newTab}</span></a></li>
            ))}
          </ul>
        </nav>
        <nav aria-label={kk ? 'Сатып алушыға көмек' : 'Помощь покупателю'}>
          <h2>{kk ? 'Сатып алушыға' : 'Покупателю'}</h2>
          <ul>
            {buyerLinks.map(([path, ru, kz]) => (
              <li key={path}><a href={`https://ekt.kz${path}`} target="_blank" rel="noopener noreferrer">{kk ? kz : ru}<span className="visually-hidden"> — {newTab}</span></a></li>
            ))}
          </ul>
        </nav>
      </div>
      <div className="ekt-footer__bottom">
        <span>Jarvis <span aria-hidden="true">/</span> EKT</span>
        <span>{kk ? 'Сілтемелер EKT ресми сайтына апарады' : 'Ссылки ведут на официальный сайт EKT'}</span>
      </div>
    </footer>
  );
}
