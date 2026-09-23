'use client';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, History, LoaderCircle, LogOut, MessageCircle, Plus, Save, Trash2, UserRound } from 'lucide-react';
import Modal from '../Modal';
import type { Locale } from '@/lib/types';
import { storedHistoryMessages, type AccountUser, type HistoryConversation, type HistoryMessage, type HistorySummary } from '@/lib/history-types';
import './account.css';

const AuthPanel = dynamic(() => import('./AuthPanel'), { ssr: false, loading: () => <div className="account-loading"><LoaderCircle size={22} className="spin" /></div> });
export interface AccountHistoryProps {
  locale: Locale;
  messages: HistoryMessage[];
  conversationId: string | null;
  onConversationIdChange: (id: string | null) => void;
  onRestore: (messages: HistoryMessage[], id: string) => void;
  onNew: () => void;
}

export default function AccountHistory({ locale, messages, conversationId, onConversationIdChange, onRestore, onNew }: AccountHistoryProps) {
  const ru = locale === 'ru';
  const [mode, setMode] = useState<'closed'|'auth'|'history'>('closed');
  const [user, setUser] = useState<AccountUser | null>(null);
  const [rows, setRows] = useState<HistorySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const revisions = useRef(new Map<string, number>());
  const fingerprints = useRef(new Map<string, string>());
  const activeController = useRef<AbortController | null>(null);
  const operation = useRef(0);
  const loadOperation = useRef(0);
  const current = useRef({ conversationId, owner: user?.id, firstMessage: messages[0]?.id });
  current.current = { conversationId, owner: user?.id, firstMessage: messages[0]?.id };
  const busyRef = useRef(false);
  const previousOwner = useRef<string | null>(null);
  const propsRef = useRef({ onNew, onConversationIdChange });
  propsRef.current = { onNew, onConversationIdChange };

  const load = useCallback(async () => {
    const stamp = ++loadOperation.current;
    setLoading(true);
    try {
      const response = await fetch('/api/history', { cache: 'no-store' });
      const data = await response.json();
      if (stamp !== loadOperation.current) return null;
      if (response.status === 401) { setUser(null); setRows([]); return null; }
      if (!response.ok) throw new Error(data.error || 'История недоступна / Тарих қолжетімсіз');
      setUser(data.user); setRows(data.conversations);
      for (const row of data.conversations as HistorySummary[]) if (!revisions.current.has(row.id)) revisions.current.set(row.id, row.revision);
      setError(''); return data.user as AccountUser;
    } catch (failure) { if (stamp === loadOperation.current) setError(failure instanceof Error ? failure.message : 'История недоступна / Тарих қолжетімсіз'); return null; }
    finally { if (stamp === loadOperation.current) setLoading(false); }
  }, []);

  useEffect(() => { void load(); return () => { activeController.current?.abort(); operation.current++; loadOperation.current++; }; }, [load]);
  useEffect(() => {
    const owner = user?.id || null;
    if (previousOwner.current && previousOwner.current !== owner) {
      activeController.current?.abort(); operation.current++;
      revisions.current.clear(); fingerprints.current.clear(); setSaved(false);
      if (current.current.conversationId) { propsRef.current.onConversationIdChange(null); propsRef.current.onNew(); }
    }
    previousOwner.current = owner;
  }, [user?.id]);
  useEffect(() => { activeController.current?.abort(); operation.current++; setSaved(false); }, [conversationId, messages[0]?.id]);

  async function save(manual = true) {
    if (!user || !messages.length || busyRef.current) return;
    const owner = user.id, oldId = conversationId, firstMessage = messages[0].id;
    const controller = new AbortController(); activeController.current?.abort(); activeController.current = controller;
    const stamp = ++operation.current;
    busyRef.current = true; setBusy(true); setError('');
    try {
      const stored = storedHistoryMessages(messages);
      const body = JSON.stringify({ id: oldId || undefined, revision: oldId ? revisions.current.get(oldId) : undefined, locale, messages: stored });
      const response = await fetch('/api/history', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, signal: controller.signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || (ru ? 'Не удалось сохранить диалог' : 'Диалог сақталмады'));
      if (stamp !== operation.current || current.current.owner !== owner || current.current.conversationId !== oldId || current.current.firstMessage !== firstMessage) return;
      const summary = data.conversation as HistorySummary;
      revisions.current.set(summary.id, summary.revision);
      fingerprints.current.set(summary.id, JSON.stringify(stored));
      setRows(existing => [summary, ...existing.filter(row => row.id !== summary.id)]);
      setSaved(true); onConversationIdChange(summary.id);
      if (manual) setMode('history');
    } catch (failure) { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : (ru ? 'Не удалось сохранить диалог' : 'Диалог сақталмады')); }
    finally { busyRef.current = false; setBusy(false); }
  }
  const saveRef = useRef(save); saveRef.current = save;
  useEffect(() => {
    // First save always requires a deliberate click; logging in never copies a guest chat.
    if (busy || error || !user || !conversationId || !messages.length || messages.at(-1)?.role !== 'assistant') return;
    let fingerprint: string;
    try { fingerprint = JSON.stringify(storedHistoryMessages(messages)); } catch { return; }
    if (fingerprints.current.get(conversationId) === fingerprint) return;
    const timer = setTimeout(() => void saveRef.current(false), 1200);
    return () => clearTimeout(timer);
  }, [messages, locale, conversationId, user, busy, error]);

  async function restore(id: string) {
    if (busyRef.current) return;
    activeController.current?.abort(); const controller = new AbortController(); activeController.current = controller;
    const stamp = ++operation.current, owner = user?.id;
    busyRef.current = true; setBusy(true); setError('');
    try {
      const response = await fetch(`/api/history/${encodeURIComponent(id)}`, { cache: 'no-store', signal: controller.signal }); const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      if (stamp !== operation.current || owner !== current.current.owner) return;
      const conversation = data.conversation as HistoryConversation;
      revisions.current.set(id, conversation.revision); fingerprints.current.set(id, JSON.stringify(storedHistoryMessages(conversation.messages)));
      onConversationIdChange(id); onRestore(conversation.messages, id); setMode('closed');
    } catch (failure) { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Не удалось открыть диалог / Диалог ашылмады'); }
    finally { busyRef.current = false; setBusy(false); }
  }
  async function remove(id: string) {
    if (busyRef.current) return;
    activeController.current?.abort(); const controller = new AbortController(); activeController.current = controller;
    const stamp = ++operation.current, owner = user?.id;
    busyRef.current = true; setBusy(true); setError('');
    try {
      const response = await fetch(`/api/history/${encodeURIComponent(id)}`, { method: 'DELETE', signal: controller.signal }); const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      if (stamp !== operation.current || owner !== current.current.owner) return;
      setRows(existing => existing.filter(row => row.id !== id)); revisions.current.delete(id); fingerprints.current.delete(id); setDeleteId(null);
      if (conversationId === id) { onConversationIdChange(null); onNew(); }
    } catch (failure) { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Не удалось удалить диалог / Диалог жойылмады'); }
    finally { busyRef.current = false; setBusy(false); }
  }
  async function signOut() {
    activeController.current?.abort(); operation.current++; loadOperation.current++; busyRef.current = true; setBusy(true); setLoading(false);
    try {
      const { authClient } = await import('@/lib/auth-client'); const result = await authClient.signOut();
      if (result.error) throw new Error(result.error.message || 'Выход не выполнен / Шығу орындалмады');
      setUser(null); setRows([]); setMode('closed');
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Выход не выполнен / Шығу орындалмады'); }
    finally { busyRef.current = false; setBusy(false); }
  }
  return <>
    <button className="account-history-trigger" disabled={loading && !user} onClick={() => { setMode(user ? 'history' : 'auth'); setDeleteId(null); if (user) void load(); }} aria-label={user ? (ru ? 'Аккаунт и история' : 'Аккаунт және тарих') : (ru ? 'Войти' : 'Кіру')} title={error || user?.email || undefined}>{loading ? <LoaderCircle size={16} className="spin" /> : user ? <History size={17} /> : <UserRound size={17} />}<span>{user ? (ru ? 'История' : 'Тарих') : (ru ? 'Войти' : 'Кіру')}</span>{error ? <b aria-label={ru ? 'Ошибка сохранения: откройте историю' : 'Сақтау қатесі: тарихты ашыңыз'}>!</b> : saved && user && <Check size={12} />}</button>
    {mode !== 'closed' && <Modal title={mode === 'auth' ? (ru ? 'Аккаунт Jarvis' : 'Jarvis аккаунты') : (ru ? 'История диалогов' : 'Диалогтар тарихы')} closeLabel={ru ? 'Закрыть' : 'Жабу'} onClose={() => { if (!busy) { setMode('closed'); setDeleteId(null); } }}>
      {mode === 'auth' ? <><p className="account-description">{ru ? 'Сохраняйте диалоги в своём аккаунте. Первый диалог сохраняется только по вашей команде.' : 'Диалогтарды аккаунтыңызда сақтаңыз. Бірінші диалог тек сіздің пәрменіңізбен сақталады.'}</p><AuthPanel locale={locale} embedded onSignedIn={() => { void load().then(account => { if (account) setMode('history'); }); }} /></> : <>
        <div className="account-identity"><UserRound size={19} /><div><strong>{user?.name || (ru ? 'Ваш аккаунт' : 'Сіздің аккаунтыңыз')}</strong><span>{user?.email}</span></div><button className="icon-button" disabled={busy} onClick={() => void signOut()} aria-label={ru ? 'Выйти' : 'Шығу'} title={ru ? 'Выйти' : 'Шығу'}><LogOut size={17} /></button></div>
        {deleteId ? <div className="account-delete-confirm"><h3>{ru ? 'Удалить этот диалог?' : 'Осы диалогты жою керек пе?'}</h3><p>{ru ? 'Сохранённая копия будет удалена из вашего аккаунта.' : 'Сақталған көшірме аккаунтыңыздан жойылады.'}</p><div className="modal-actions"><button className="secondary-button" disabled={busy} onClick={() => setDeleteId(null)}>{ru ? 'Отмена' : 'Бас тарту'}</button><button className="primary-button" disabled={busy} onClick={() => void remove(deleteId)}>{busy ? <LoaderCircle size={16} className="spin" /> : <Trash2 size={16} />}{ru ? 'Удалить' : 'Жою'}</button></div></div> : <>
          <div className="account-actions"><button className="primary-button" disabled={busy || !messages.length} onClick={() => void save()}>{busy ? <LoaderCircle size={16} className="spin" /> : <Save size={16} />}{ru ? 'Сохранить диалог' : 'Диалогты сақтау'}</button><button className="secondary-button" disabled={busy} onClick={() => { onConversationIdChange(null); onNew(); setMode('closed'); }}><Plus size={16} />{ru ? 'Новый' : 'Жаңа'}</button></div>
          <p className="account-description">{ru ? 'После первого сохранения новые ответы сохраняются автоматически. Сохраняются текст, имена файлов и ссылки на товары. Цены в тексте исторические; карточки повторно загружаются из каталога.' : 'Алғашқы сақтаудан кейін жаңа жауаптар автоматты сақталады. Мәтін, файл атаулары және тауар сілтемелері сақталады. Мәтіндегі бағалар тарихи; карточкалар каталогтан қайта жүктеледі.'}</p>
          {loading ? <div className="account-loading"><LoaderCircle className="spin" size={23} /></div> : !rows.length ? <div className="account-empty"><MessageCircle size={28} /><p>{ru ? 'Сохранённых диалогов пока нет' : 'Сақталған диалогтар әлі жоқ'}</p></div> : <div className="account-history-list">{rows.map(row => <article key={row.id} className={row.id === conversationId ? 'is-current' : ''}><button disabled={busy} onClick={() => void restore(row.id)}><strong>{row.title}</strong><span>{new Date(row.updatedAt).toLocaleString(ru ? 'ru-KZ' : 'kk-KZ', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })} · {row.messageCount} {ru ? 'сообщ.' : 'хабарлама'}</span></button><button className="icon-button" disabled={busy} onClick={() => setDeleteId(row.id)} aria-label={`${ru ? 'Удалить' : 'Жою'}: ${row.title}`}><Trash2 size={16} /></button></article>)}</div>}
        </>}
      </>}
      {error && <p className="inline-error" role="alert">{error}</p>}
    </Modal>}
  </>;
}
