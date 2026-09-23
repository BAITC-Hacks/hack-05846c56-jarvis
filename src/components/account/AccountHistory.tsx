'use client';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import { Check, History, LoaderCircle, LogOut, MessageCircle, Plus, Save, Trash2, UserRound } from 'lucide-react';
import Modal from '../Modal';
import type { Locale } from '@/lib/types';
import { storedHistoryMessages, type AccountUser, type HistoryConversation, type HistoryMessage, type HistorySummary } from '@/lib/history-types';
import './account.css';

const AuthPanel = dynamic(() => import('./AuthPanel'), { ssr: false, loading: () => <div className="account-loading"><LoaderCircle size={22} className="spin" /></div> });
class HistorySaveError extends Error { constructor(message:string,public status:number,public code?:string){super(message);} }
export interface AccountHistoryHandle { requestNew: () => Promise<boolean> }
export interface HistorySnapshot { messages: HistoryMessage[]; conversationId: string | null }
export interface AccountHistoryProps {
  ref?: Ref<AccountHistoryHandle>;
  locale: Locale;
  messages: HistoryMessage[];
  conversationId: string | null;
  getSnapshot: () => HistorySnapshot;
  onConversationIdChange: (id: string | null) => void;
  onRestore: (messages: HistoryMessage[], id: string) => void;
  onNew: () => void;
  onGuestNew: () => void;
  onBeforeTransition: () => boolean;
  onTransitionChange: (busy: boolean) => void;
}

export default function AccountHistory({ ref, locale, messages, conversationId, ...callbacks }: AccountHistoryProps) {
  const ru = locale === 'ru';
  const [mode, setMode] = useState<'closed'|'auth'|'history'>('closed');
  const [user, setUser] = useState<AccountUser | null>(null);
  const [rows, setRows] = useState<HistorySummary[]>([]);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false);
  const [error, setError] = useState(''), [saved, setSaved] = useState(false);
  const [conflict,setConflict] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const revisions = useRef(new Map<string, number>()), fingerprints = useRef(new Map<string, string>());
  const owner = useRef<AccountUser | null>(null), authKnown = useRef(false);
  const props = useRef({ ...callbacks, locale }); props.current = { ...callbacks, locale };
  const mounted = useRef(true), actionLock = useRef(false), generation = useRef(0), loadOperation = useRef(0);
  const pendingSave = useRef<Promise<void> | null>(null);
  const controller = useRef<AbortController | null>(null);
  function recordRevision(id:string,revision:number) {
    revisions.current.set(id,revision);
    try{sessionStorage.setItem('jarvis-active-history',JSON.stringify({id,revision,ownerId:owner.current?.id}));}catch{/* Optimistic revision remains available for this page. */}
  }
  const failure = (value: unknown) => { if (mounted.current) { setConflict(value instanceof HistorySaveError && value.status===409 && (!value.code || value.code==='HISTORY_CONFLICT'));setError(value instanceof Error ? value.message : (ru ? 'Не удалось сохранить диалог. Переключение отменено.' : 'Диалог сақталмады. Ауыстыру тоқтатылды.')); setSaved(false); } };

  const load = useCallback(async () => {
    const stamp = ++loadOperation.current; setLoading(true);
    try {
      const response = await fetch('/api/history', { cache: 'no-store' }); const data = await response.json();
      if (!mounted.current || stamp !== loadOperation.current) return owner.current;
      const guest = response.status === 401 || (response.status === 403 && data.code === 'EMAIL_NOT_VERIFIED') || (response.status === 503 && data.code === 'AUTH_NOT_CONFIGURED');
      if (!guest && !response.ok) throw new Error(data.error || 'История недоступна / Тарих қолжетімсіз');
      const next = guest ? null : data.user as AccountUser;
      const changedOwner = owner.current && owner.current.id !== next?.id;
      if (changedOwner) { generation.current++; controller.current?.abort(); revisions.current.clear(); fingerprints.current.clear(); }
      owner.current = next; authKnown.current = true; setUser(next); setRows(guest ? [] : data.conversations);
      const snapshot = props.current.getSnapshot();
      // A persisted active ID is trusted only when the verified owner's list contains it.
      if (changedOwner || (snapshot.conversationId && (guest || !data.conversations.some((row: HistorySummary) => row.id === snapshot.conversationId)))) {
        props.current.onConversationIdChange(null); props.current.onNew(); setSaved(false);
      }
      let cachedRevision: {id?:string;revision?:number;ownerId?:string}={};
      try{cachedRevision=JSON.parse(sessionStorage.getItem('jarvis-active-history')||'{}');}catch{/* No persisted revision. */}
      if (!guest) for (const row of data.conversations as HistorySummary[]) if (!revisions.current.has(row.id)) revisions.current.set(row.id, row.id===snapshot.conversationId && cachedRevision.id===row.id && cachedRevision.ownerId===next?.id && Number.isInteger(cachedRevision.revision) && Number(cachedRevision.revision)>0 ? Number(cachedRevision.revision) : row.revision);
      return next;
    } catch (value) { if (mounted.current && stamp === loadOperation.current) { authKnown.current = false; setError(value instanceof Error ? value.message : 'История недоступна / Тарих қолжетімсіз'); } return null; }
    finally { if (mounted.current && stamp === loadOperation.current) setLoading(false); }
  }, []);
  useEffect(() => { mounted.current = true; void load(); return () => { mounted.current = false; generation.current++; loadOperation.current++; controller.current?.abort(); }; }, [load]);

  async function saveLatest(asCopy = false): Promise<void> {
    // Never abort a write merely to start another one: it may already have committed remotely.
    while (pendingSave.current) await pendingSave.current;
    const snapshot = props.current.getSnapshot(), account = owner.current;
    if (!account || !snapshot.messages.length) return;
    const stored = storedHistoryMessages(snapshot.messages), fingerprint = JSON.stringify(stored);
    const oldId = snapshot.conversationId, first = snapshot.messages[0].id;
    if (!asCopy && oldId && fingerprints.current.get(oldId) === fingerprint) return;
    const stamp = generation.current;
    const signalController = new AbortController(); controller.current = signalController;
    loadOperation.current++; setLoading(false);
    const job = (async () => {
      const response = await fetch('/api/history', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({id:asCopy ? undefined : oldId || undefined,revision:!asCopy && oldId ? revisions.current.get(oldId) : undefined,title:asCopy ? `${stored.find(message=>message.role==='user')?.content.slice(0,100) || 'Jarvis'} (${ru?'копия':'көшірме'})` : undefined,locale:props.current.locale,messages:stored}), signal:signalController.signal });
      const data = await response.json();
      if (!response.ok) throw new HistorySaveError(data.error || 'Диалог не сохранён / Диалог сақталмады',response.status,data.code);
      const latest = props.current.getSnapshot();
      if (!mounted.current || generation.current !== stamp || owner.current?.id !== account.id || latest.conversationId !== oldId || latest.messages[0]?.id !== first) throw new Error('Диалог изменился. Повторите действие / Диалог өзгерді. Әрекетті қайталаңыз');
      const summary = data.conversation as HistorySummary;
      recordRevision(summary.id,summary.revision); fingerprints.current.set(summary.id,fingerprint);
      props.current.onConversationIdChange(summary.id);
      setRows(existing => [summary,...existing.filter(row => row.id !== summary.id)]); setSaved(true);setConflict(false);
    })();
    pendingSave.current = job;
    try { await job; } finally { if (pendingSave.current === job) pendingSave.current = null; }
  }
  async function flushLatest() {
    // New responses can arrive while a background save finishes. Read the parent's synchronous snapshot again.
    if (pendingSave.current) { try { await pendingSave.current; } catch { /* retry the latest snapshot once; a conflict still blocks switching */ } }
    for (;;) {
      await saveLatest();
      const snapshot = props.current.getSnapshot();
      if (!snapshot.messages.length || (snapshot.conversationId && fingerprints.current.get(snapshot.conversationId) === JSON.stringify(storedHistoryMessages(snapshot.messages)))) return;
      if (!owner.current) throw new Error('Войдите снова / Қайта кіріңіз');
    }
  }
  async function save(manual = true) {
    if (actionLock.current || transitionLock.current || !owner.current || !props.current.getSnapshot().messages.length) return;
    actionLock.current = true; setBusy(true); setError('');
    const stamp=generation.current;
    try { await flushLatest(); if (manual) setMode('history'); }
    catch (value) { if(stamp===generation.current)failure(value); }
    finally { actionLock.current = false; if (mounted.current) setBusy(transitionLock.current); }
  }
  const saveRef = useRef(save); saveRef.current = save;
  async function saveCopy() {
    if(actionLock.current || transitionLock.current)return;
    actionLock.current=true;setBusy(true);setError('');
    try{await saveLatest(true);setConflict(false);}catch(value){failure(value);}finally{actionLock.current=false;if(mounted.current)setBusy(false);}
  }
  useEffect(() => {
    // Initial save occurs on explicit Save OR before New/Restore. Login alone never copies a guest chat.
    if (busy || error || !user || !conversationId || !messages.length || messages.at(-1)?.role !== 'assistant') return;
    try { if (fingerprints.current.get(conversationId) === JSON.stringify(storedHistoryMessages(messages))) return; } catch { return; }
    const timer = setTimeout(() => void saveRef.current(false),1200); return () => clearTimeout(timer);
  }, [messages,locale,conversationId,user,busy,error]);

  async function transition(target: 'new'|'restore'|'logout', id?: string): Promise<boolean> {
    // One foreground transition owns the chat until its save and target load have both succeeded.
    if (actionLock.current && !pendingSave.current) return false;
    if (transitionLock.current) return false;
    transitionLock.current = true; props.current.onTransitionChange(true); setBusy(true); setError('');
    try {
      if (!authKnown.current || !owner.current) await load();
      if (!authKnown.current) throw new Error(ru ? 'Не удалось проверить аккаунт. Диалог оставлен открытым; повторите.' : 'Аккаунт тексерілмеді. Диалог ашық қалды; қайталаңыз.');
      if (!owner.current) { if (target === 'new') { setMode('closed'); props.current.onGuestNew(); return true; } throw new Error(ru ? 'Войдите снова.' : 'Қайта кіріңіз.'); }
      if (target === 'restore' && id === props.current.getSnapshot().conversationId) { setMode('closed'); return true; }
      if (!props.current.onBeforeTransition()) return false;
      const accountId = owner.current.id, stamp = generation.current;
      if (target !== 'logout') await flushLatest();
      if (owner.current?.id !== accountId || generation.current !== stamp) throw new Error(ru ? 'Аккаунт изменился. Повторите.' : 'Аккаунт өзгерді. Қайталаңыз.');
      if (target === 'new') { props.current.onConversationIdChange(null); props.current.onNew(); setSaved(false); }
      else if (target === 'restore' && id) {
        const abort = new AbortController(); controller.current = abort;
        const response = await fetch(`/api/history/${encodeURIComponent(id)}`,{cache:'no-store',signal:abort.signal}); const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Диалог не найден / Диалог табылмады');
        if (!mounted.current || owner.current?.id !== accountId || generation.current !== stamp) return false;
        const conversation = data.conversation as HistoryConversation;
        recordRevision(id,conversation.revision); fingerprints.current.set(id,JSON.stringify(storedHistoryMessages(conversation.messages)));
        props.current.onConversationIdChange(id); props.current.onRestore(conversation.messages,id); setSaved(true);
      } else if (target === 'logout') {
        const {authClient} = await import('@/lib/auth-client'); const result = await authClient.signOut();
        if (result.error) throw new Error(result.error.message || 'Выход не выполнен / Шығу орындалмады');
        generation.current++; loadOperation.current++; owner.current=null; authKnown.current=true; setUser(null); setRows([]); revisions.current.clear(); fingerprints.current.clear();
        props.current.onConversationIdChange(null); props.current.onNew(); setSaved(false);
      }
      setMode('closed'); setDeleteId(null); return true;
    } catch (value) { failure(value); setMode(owner.current ? 'history' : 'auth'); return false; }
    finally { transitionLock.current=false; props.current.onTransitionChange(false); if (mounted.current) setBusy(false); }
  }
  const transitionLock = useRef(false), transitionRef = useRef(transition); transitionRef.current = transition;
  useImperativeHandle(ref,()=>({requestNew:()=>transitionRef.current('new')}),[]);
  async function restore(id: string) { return transition('restore',id); }
  async function signOut() {
    if (transitionLock.current) return;
    transitionLock.current=true; generation.current++; loadOperation.current++; controller.current?.abort();
    setBusy(true); setError(''); props.current.onTransitionChange(true);
    try {
      const {authClient}=await import('@/lib/auth-client'); const result=await authClient.signOut();
      if(result.error)throw new Error(result.error.message || 'Выход не выполнен / Шығу орындалмады');
      owner.current=null;authKnown.current=true;setUser(null);setRows([]);revisions.current.clear();fingerprints.current.clear();
      props.current.onConversationIdChange(null);props.current.onNew();setSaved(false);setMode('closed');
    }catch(value){failure(value);}finally{transitionLock.current=false;props.current.onTransitionChange(false);if(mounted.current)setBusy(false);}
  }
  async function remove(id: string) {
    if (actionLock.current || transitionLock.current) return;
    actionLock.current=true; setBusy(true); setError('');
    try {
      if (pendingSave.current) await pendingSave.current;
      const accountId=owner.current?.id,stamp=generation.current;
      loadOperation.current++; setLoading(false);
      const response=await fetch(`/api/history/${encodeURIComponent(id)}`,{method:'DELETE'});const data=await response.json();
      if(!response.ok)throw new Error(data.error);
      if(!mounted.current||accountId!==owner.current?.id||stamp!==generation.current)return;
      setRows(existing=>existing.filter(row=>row.id!==id));revisions.current.delete(id);fingerprints.current.delete(id);setDeleteId(null);
      if(props.current.getSnapshot().conversationId===id){props.current.onConversationIdChange(null);props.current.onNew();setSaved(false);}
    }catch(value){failure(value);}finally{actionLock.current=false;if(mounted.current)setBusy(false);}
  }
  return <>
    <button className="account-history-trigger" disabled={loading && !user} onClick={() => { setMode(user ? 'history' : 'auth'); setDeleteId(null); if (user) void load(); }} aria-label={user ? (ru ? 'Аккаунт и история' : 'Аккаунт және тарих') : (ru ? 'Войти' : 'Кіру')} title={error || user?.email || undefined}>{loading ? <LoaderCircle size={16} className="spin" /> : user ? <History size={17} /> : <UserRound size={17} />}<span>{user ? (ru ? 'История' : 'Тарих') : (ru ? 'Войти' : 'Кіру')}</span>{error ? <b aria-label={ru ? 'Ошибка сохранения: откройте историю' : 'Сақтау қатесі: тарихты ашыңыз'}>!</b> : saved && user && <Check size={12} />}</button>
    {mode !== 'closed' && <Modal title={mode === 'auth' ? (ru ? 'Аккаунт Jarvis' : 'Jarvis аккаунты') : (ru ? 'История диалогов' : 'Диалогтар тарихы')} closeLabel={ru ? 'Закрыть' : 'Жабу'} onClose={() => { if (!busy) { setMode('closed'); setDeleteId(null); } }}>
      {mode === 'auth' ? <><p className="account-description">{ru ? 'Диалог сохранится в аккаунте при переходе к новому или другому диалогу. Вход сам по себе не сохраняет гостевую переписку.' : 'Жаңа немесе басқа диалогқа ауысқанда диалог аккаунтта сақталады. Кірудің өзі қонақ диалогын сақтамайды.'}</p><AuthPanel locale={locale} embedded onSignedIn={() => { void load().then(account => { if (account) setMode('history'); }); }} /></> : <>
        <div className="account-identity"><UserRound size={19} /><div><strong>{user?.name || (ru ? 'Ваш аккаунт' : 'Сіздің аккаунтыңыз')}</strong><span>{user?.email}</span></div><button className="icon-button" disabled={busy} onClick={() => void signOut()} aria-label={ru ? 'Выйти' : 'Шығу'} title={ru ? 'Выйти' : 'Шығу'}><LogOut size={17} /></button></div>
        {user?.email !== 'demo@jarvis-ekt.example' && <a className="text-button account-password-link" href="/auth/forgot-password">{ru ? 'Установить / восстановить пароль' : 'Құпиясөз орнату / қалпына келтіру'}</a>}
        {user?.email === 'demo@jarvis-ekt.example' && <p className="account-description">{ru ? 'Общий демо-аккаунт: сохраняйте только тестовые данные. Историю видят все, кто входит как user1.' : 'Ортақ демо-аккаунт: тек сынақ деректерін сақтаңыз. user1 арқылы кіргендердің бәрі тарихты көреді.'}</p>}
        {deleteId ? <div className="account-delete-confirm"><h3>{ru ? 'Удалить этот диалог?' : 'Осы диалогты жою керек пе?'}</h3><p>{ru ? 'Сохранённая копия будет удалена из вашего аккаунта.' : 'Сақталған көшірме аккаунтыңыздан жойылады.'}</p><div className="modal-actions"><button className="secondary-button" disabled={busy} onClick={() => setDeleteId(null)}>{ru ? 'Отмена' : 'Бас тарту'}</button><button className="primary-button" disabled={busy} onClick={() => void remove(deleteId)}>{busy ? <LoaderCircle size={16} className="spin" /> : <Trash2 size={16} />}{ru ? 'Удалить' : 'Жою'}</button></div></div> : <>
          <div className="account-actions"><button className="primary-button" disabled={busy || !messages.length} onClick={() => void save()}>{busy ? <LoaderCircle size={16} className="spin" /> : <Save size={16} />}{ru ? 'Сохранить диалог' : 'Диалогты сақтау'}</button><button className="secondary-button" disabled={busy} onClick={() => void transition('new')}><Plus size={16} />{ru ? 'Новый' : 'Жаңа'}</button></div>
          <p className="account-description">{ru ? 'При переходе к новому или другому диалогу текущая переписка сохраняется автоматически. Продолжение сохранённого диалога тоже обновляется. Сохраняются текст, имена файлов и ссылки на товары. Цены в тексте исторические; карточки повторно загружаются из каталога.' : 'Жаңа немесе басқа диалогқа ауысқанда ағымдағы әңгіме автоматты сақталады. Сақталған диалогтың жалғасы да жаңартылады. Мәтін, файл атаулары және тауар сілтемелері сақталады. Мәтіндегі бағалар тарихи; карточкалар каталогтан қайта жүктеледі.'}</p>
          {loading ? <div className="account-loading"><LoaderCircle className="spin" size={23} /></div> : !rows.length ? <div className="account-empty"><MessageCircle size={28} /><p>{ru ? 'Сохранённых диалогов пока нет' : 'Сақталған диалогтар әлі жоқ'}</p></div> : <div className="account-history-list">{rows.map(row => <article key={row.id} className={row.id === conversationId ? 'is-current' : ''}><button disabled={busy} onClick={() => void restore(row.id)}><strong>{row.title}</strong><span>{new Date(row.updatedAt).toLocaleString(ru ? 'ru-KZ' : 'kk-KZ', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })} · {row.messageCount} {ru ? 'сообщ.' : 'хабарлама'}</span></button><button className="icon-button" disabled={busy} onClick={() => setDeleteId(row.id)} aria-label={`${ru ? 'Удалить' : 'Жою'}: ${row.title}`}><Trash2 size={16} /></button></article>)}</div>}
        </>}
      </>}
      {error && <p className="inline-error" role="alert">{error}</p>}
      {conflict && <div><p className="account-description">{ru?'Текущий текст остался на экране. Можно сохранить его отдельной копией, не заменяя версию из другой вкладки.':'Ағымдағы мәтін экранда қалды. Басқа қойындыдағы нұсқаны өзгертпей, оны бөлек көшірме ретінде сақтауға болады.'}</p><button className="secondary-button" disabled={busy} onClick={()=>void saveCopy()}>{ru?'Сохранить отдельную копию':'Бөлек көшірмені сақтау'}</button></div>}
    </Modal>}
  </>;
}
