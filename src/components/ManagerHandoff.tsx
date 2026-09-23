'use client';

import { useState } from 'react';
import { Check, Copy, Download, Mail, Phone, ArrowUpRight } from 'lucide-react';
import type { Locale, Product } from '@/lib/types';
import Modal from './Modal';

// Public sales contacts, checked against https://ekt.kz/about/contacts/.
const offices = [
  { city: 'Алматы', email: 'almaty@ekt.kz', phone: '+77273468888', display: '+7 (727) 346-88-88' },
  { city: 'Астана', email: 'astana@ekt.kz', phone: '+77002220514', display: '+7 (700) 222-05-14' },
  { city: 'Шымкент', email: 'shymkent@ekt.kz', phone: '+77020102777', display: '+7 (702) 010-27-77' },
  { city: 'Актау', email: 'aktau@ekt.kz', phone: '+77787529534', display: '+7 (778) 752-95-34' },
  { city: 'Атырау', email: 'atyrau@ekt.kz', phone: '+77010813356', display: '+7 (701) 081-33-56' },
  { city: 'Тараз', email: 'taraz@ekt.kz', phone: '+77787529537', display: '+7 (778) 752-95-37' },
  { city: 'Усть-Каменогорск', email: 'yk@ekt.kz', phone: '+77057525701', display: '+7 (705) 752-57-01' },
  { city: 'Караганда', email: 'karaganda@ekt.kz', phone: '+77787529538', display: '+7 (778) 752-95-38' },
  { city: 'Талдыкорган', email: 'tk@ekt.kz', phone: '+77282309015', display: '+7 (728) 230-90-15' },
];

export default function ManagerHandoff({ locale, products, question, onClose }: { locale: Locale; products: Product[]; question: string; onClose: () => void }) {
  const ru = locale === 'ru';
  const [city, setCity] = useState(0);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const [text, setText] = useState(() => [ru ? 'Здравствуйте! Нужна помощь с подбором оборудования.' : 'Сәлеметсіз бе! Жабдық таңдауға көмек қажет.', '', ...products.slice(0, 8).map(product => `${product.name}\n${ru ? 'Артикул' : 'Артикул'}: ${product.sku}\n${product.url}`), '', ru ? 'Мой вопрос: ' : 'Менің сұрағым: '].join('\n'));
  const office = offices[city];
  function download() {
    const url = URL.createObjectURL(new Blob(['\ufeff', text], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'Jarvis-EKT-request.txt'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function copy() { try { await navigator.clipboard.writeText(text); setCopied(true); setCopyError(false); } catch { setCopyError(true); } }
  const mailBody = text.length <= 1600 ? text : (ru ? 'Здравствуйте! Нужна консультация по подборке Jarvis. Текст запроса приложу отдельно.' : 'Сәлеметсіз бе! Jarvis тізімі бойынша кеңес қажет. Сұрағымды бөлек тіркеймін.');
  return <Modal title={ru ? 'Связаться с менеджером' : 'Менеджермен байланысу'} closeLabel={ru ? 'Закрыть' : 'Жабу'} onClose={onClose}>
    <p className="modal-description">{ru ? 'Проверьте запрос и выберите отдел продаж EKT. Вы сами отправите письмо из своей почты или позвоните менеджеру.' : 'Сұрағыңызды тексеріп, EKT сату бөлімін таңдаңыз. Хатты өз поштаңыздан жіберіңіз немесе менеджерге қоңырау шалыңыз.'}</p>
    <label className="handoff-field"><span>{ru ? 'Город' : 'Қала'}</span><select aria-label={ru ? 'Город' : 'Қала'} value={city} onChange={event => setCity(Number(event.target.value))}>{offices.map((item, index) => <option key={item.city} value={index}>{item.city}</option>)}</select></label>
    <label className="handoff-field"><span>{ru ? 'Текст обращения' : 'Өтініш мәтіні'}</span><textarea aria-label={ru ? 'Текст обращения' : 'Өтініш мәтіні'} rows={8} maxLength={6000} value={text} onChange={event => { setText(event.target.value); setCopied(false); }} /></label>
    {question && <button className="text-button" onClick={() => setText(current => `${current}\n${question}`.slice(0, 6000))}>{ru ? 'Добавить мой последний вопрос' : 'Соңғы сұрағымды қосу'}</button>}
    <p className="small-note">{ru ? 'История чата и вложения автоматически не передаются. Перед отправкой удалите из текста лишние личные данные.' : 'Чат тарихы мен тіркемелер автоматты түрде жіберілмейді. Жіберер алдында қажетсіз жеке деректерді өшіріңіз.'}</p>
    <div className="handoff-actions"><button className="secondary-button" onClick={() => void copy()}>{copied ? <Check size={16} /> : <Copy size={16} />}{ru ? (copied ? 'Скопировано' : 'Скопировать') : (copied ? 'Көшірілді' : 'Көшіру')}</button><button className="secondary-button" onClick={download}><Download size={16} />{ru ? 'Скачать запрос' : 'Сұрауды жүктеу'}</button></div>
    {copyError && <p className="inline-error" role="alert">{ru ? 'Не удалось скопировать. Выделите текст вручную или скачайте файл.' : 'Көшіру мүмкін болмады. Мәтінді қолмен таңдаңыз немесе файлды жүктеңіз.'}</p>}
    {text.length > 1600 && <p className="small-note">{ru ? 'Запрос длинный: скачайте файл и приложите его к письму.' : 'Сұрау ұзақ: файлды жүктеп, хатқа тіркеңіз.'}</p>}
    <div className="handoff-actions"><a className="primary-button" href={`mailto:${office.email}?subject=${encodeURIComponent(ru ? 'Консультация по подборке Jarvis' : 'Jarvis тізімі бойынша кеңес')}&body=${encodeURIComponent(mailBody)}`}><Mail size={16} />{ru ? 'Открыть письмо' : 'Хат ашу'}</a><a className="secondary-button" href={`tel:${office.phone}`}><Phone size={16} />{office.display}</a></div>
    <p className="small-note">{office.email}</p><a className="text-button" href="https://ekt.kz/about/contacts/" target="_blank" rel="noopener noreferrer">{ru ? 'Контакты на сайте EKT' : 'EKT сайтындағы байланыстар'}<ArrowUpRight size={14} /></a>
  </Modal>;
}
