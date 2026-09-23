'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ArrowUpRight, Check, CheckCheck, ChevronRight, CircleHelp, FileText, GitCompareArrows, Globe2, Grid2X2, LoaderCircle, Minus, PackageCheck, Paperclip, Plus, Search, ShieldCheck, ShoppingBag, SlidersHorizontal, Sparkles, Square, Trash2, Truck, X, Zap } from 'lucide-react';
import { copy, money } from '@/lib/i18n';
import type { Attachment, Cart, CartLine, ChatMessage, ChatResponse, Locale, Product } from '@/lib/types';
import PromptBar from './PromptBar';
import SpecularButton from './SpecularButton';
import GooeyNav from './GooeyNav';
import DepthLogo from './original/DepthLogo';
import OriginalDotField from './original/OriginalDotField';
import ScrollReveal from './original/ScrollReveal';
import ScrollVelocity from './original/ScrollVelocity';
import SmoothScroll from './original/SmoothScroll';
import './original/original-motion.css';
import Modal from './Modal';
import ProductCard, { ProductImage } from './ProductCard';

function minimumQuantity(product: Product) { const value = Number((product.specs.KRATNOST_MIN || '1').replace(',', '.')); return Number.isFinite(value) && value > 0 ? value : 1; }
function validQuantity(quantity: number, product: Product) { const step = minimumQuantity(product); return Number.isFinite(quantity) && quantity >= step && quantity <= product.stock && Math.abs(quantity / step - Math.round(quantity / step)) < 0.000001; }
type UploadAttachment = Attachment & { byteSize?: number };

type View = 'assistant' | 'catalog' | 'cart';
type DisplayMessage = ChatMessage & { id: string; products?: Product[]; sources?: ChatResponse['sources']; suggestions?: string[]; attachments?: string[]; proposedItems?: ChatResponse['proposedItems']; mode?: ChatResponse['mode'] };
type Proposal = { token: string; items: CartLine[]; operation: 'add' | 'set' | 'remove'; expiresAt: string };

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...options, headers: { ...(options?.body && typeof options.body === 'string' ? { 'Content-Type': 'application/json' } : {}), ...options?.headers } });
  const data = await response.json();
  if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : data.error?.message || data.message || `HTTP ${response.status}`);
  return data as T;
}

function MessageText({ text }: { text: string }) {
  // Render only text and a small safe subset of Markdown, never raw HTML.
  return <div className="message-text">{text.split('\n').map((line, index) => <p key={index}>{line.split(/(\*\*[^*]+\*\*)/g).map((part, i) => part.startsWith('**') && part.endsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : part)}{!line && <br />}</p>)}</div>;
}

export default function JarvisApp({ initialView = 'assistant' }: { initialView?: View }) {
  const [locale, setLocale] = useState<Locale>('ru');
  const t = copy[locale];
  const [view, setView] = useState<View>(initialView);

  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<UploadAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState('');
  const [catalogRetry, setCatalogRetry] = useState(0);
  const [compared, setCompared] = useState<Product[]>([]);
  const [detail, setDetail] = useState<Product | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [alternatives, setAlternatives] = useState<Product[]>([]);
  const [cart, setCart] = useState<Cart | null>(null);
  const [cartLoading, setCartLoading] = useState(true);
  const [cartError, setCartError] = useState('');
  const [quantityProduct, setQuantityProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [cartBusy, setCartBusy] = useState(false);
  const [proposalError, setProposalError] = useState('');
  const [resetConfirm, setResetConfirm] = useState(false);
  const [copied, setCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEnd = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const requestId = useRef(0);
  const detailRequestId = useRef(0);
  const cartCount = cart?.items.reduce((sum, item) => sum + item.quantity, 0) || 0;

  useEffect(() => {
    try {
      const storedLocale = localStorage.getItem('jarvis-locale');
      if (storedLocale === 'ru' || storedLocale === 'kk') setLocale(storedLocale);
      const history = sessionStorage.getItem('jarvis-chat');
      if (history) { const parsed = JSON.parse(history); if (Array.isArray(parsed)) setMessages(parsed.slice(-50)); }
    } catch { /* Storage can be disabled in private browser contexts. */ }
    setHydrated(true);
    return () => abortRef.current?.abort();
  }, []);
  useEffect(() => {
    document.documentElement.lang = locale;
    if (hydrated) try { localStorage.setItem('jarvis-locale', locale); } catch { /* Optional persistence. */ }
  }, [locale, hydrated]);
  useEffect(() => {
    if (hydrated) try { sessionStorage.setItem('jarvis-chat', JSON.stringify(messages.slice(-50))); } catch { /* A long chat still works without persistence. */ }
  }, [messages, hydrated]);
  useEffect(() => {
    if (messages.length && view === 'assistant') messagesEnd.current?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'end' });
  }, [messages.length, sending, view]);
  useEffect(() => { if (!toast) return; const timeout = setTimeout(() => setToast(''), 4500); return () => clearTimeout(timeout); }, [toast]);

  const loadCart = useCallback(async () => {
    setCartLoading(true); setCartError('');
    try { const data = await api<{ cart: Cart }>('/api/cart'); setCart(data.cart); }
    catch (e) { setCartError(e instanceof Error ? e.message : copy[locale].error); }
    finally { setCartLoading(false); }
  }, [locale]);
  useEffect(() => { void loadCart(); }, [loadCart]);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      setCatalogLoading(true); setCatalogError('');
      try {
        const data = await api<{ products: Product[]; categories?: string[]; total: number }>(`/api/products?q=${encodeURIComponent(query)}&category=${encodeURIComponent(category)}&limit=24`, { signal: controller.signal });
        setProducts(data.products); setTotal(data.total); if (data.categories?.length) setCategories(data.categories);
      } catch (e) { if (!controller.signal.aborted) setCatalogError(e instanceof Error ? e.message : copy[locale].error); }
      finally { if (!controller.signal.aborted) setCatalogLoading(false); }
    }, query ? 320 : 0);
    return () => { controller.abort(); clearTimeout(timeout); };
  }, [query, category, catalogRetry, locale]);

  function navigate(next: View) {
    setView(next); setError('');
    window.history.replaceState(null, '', next === 'cart' ? '/cart' : '/');
    window.scrollTo({ top: 0, behavior: 'instant' });
    if (next === 'cart') void loadCart();
  }
  function changeLocale(next: Locale) { setLocale(next); }
  async function sendMessage(text = input, context?: Product[]) {
    if (sending || uploading || (!text.trim() && !attachments.length)) return;
    const content = text.trim() || (locale === 'ru' ? 'Изучи прикреплённые файлы и помоги подобрать товары из каталога.' : 'Тіркелген файлдарды зерттеп, каталогтан тауар таңдауға көмектес.');
    const files = attachments;
    const nextMessages: DisplayMessage[] = [...messages, { id: crypto.randomUUID(), role: 'user', content, attachments: files.map(file => file.name) }];
    setMessages(nextMessages); setInput(''); setAttachments([]); setSending(true); setError(''); navigate('assistant');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    const controller = new AbortController(); abortRef.current = controller;
    const currentRequest = ++requestId.current;
    try {
      const contextProductIds = (context || messages.flatMap(message => message.products || []).slice(-8)).map(product => product.id);
      const response = await api<ChatResponse>('/api/chat', { method: 'POST', body: JSON.stringify({ messages: nextMessages.slice(-24).map(({ role, content: messageContent, products: foundProducts }) => ({ role, content: messageContent, productIds: foundProducts?.map(product => product.id) })), locale, attachments: files.map(({ byteSize: _byteSize, ...attachment }) => attachment), contextProductIds }), signal: controller.signal });
      if (currentRequest === requestId.current) setMessages(current => [...current, { id: crypto.randomUUID(), role: 'assistant', content: response.message, products: response.products, sources: response.sources, suggestions: response.suggestions, proposedItems: response.proposedItems, mode: response.mode }]);
    } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : t.error); }
    finally { if (currentRequest === requestId.current) { setSending(false); abortRef.current = null; } }
  }
  function stopSending() { abortRef.current?.abort(); requestId.current++; setSending(false); setToast(t.stopped); }
  async function uploadFiles(list: FileList | null) {
    if (!list?.length || uploading) return;
    if (attachments.length + list.length > 3) { setError(locale === 'ru' ? 'Можно прикрепить до 3 файлов.' : '3 файлға дейін тіркеуге болады.'); return; }
    if (attachments.reduce((sum, file) => sum + (file.byteSize || 0), 0) + Array.from(list).reduce((sum, file) => sum + file.size, 0) > 3 * 1024 * 1024) { setError(locale === 'ru' ? 'Общий размер файлов — до 3 МБ.' : 'Файлдардың жалпы көлемі — 3 МБ-қа дейін.'); return; }
    const form = new FormData(); Array.from(list).forEach(file => form.append('files', file));
    setUploading(true); setError('');
    try { const data = await api<{ attachments: Attachment[] }>('/api/upload', { method: 'POST', body: form }); setAttachments(current => [...current, ...data.attachments.map((file, index) => ({ ...file, byteSize: list[index]?.size || 0 }))].slice(0, 3)); textareaRef.current?.focus(); }
    catch (e) { setError(e instanceof Error ? e.message : t.error); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  }
  async function openDetails(product: Product) {
    setDetail(product); setAlternatives([]); setDetailLoading(true);
    const current = ++detailRequestId.current;
    try { const data = await api<{ product: Product; alternatives?: Product[] }>(`/api/products/${encodeURIComponent(product.id)}`); if (current === detailRequestId.current) { setDetail(data.product); setAlternatives(data.alternatives || []); } }
    catch (e) { setToast(e instanceof Error ? e.message : t.error); }
    finally { if (current === detailRequestId.current) setDetailLoading(false); }
  }
  function closeDetails() { detailRequestId.current++; setDetail(null); setDetailLoading(false); }
  function chooseQuantity(product: Product) { setProposalError(''); setQuantityProduct(product); setQuantity(minimumQuantity(product)); }
  async function propose(items: { productId: string; quantity: number }[], operation: Proposal['operation'] = 'add') {
    if (cartBusy) return;
    setCartBusy(true); setProposalError('');
    try {
      const response = await api<{ proposal: Proposal; cart: Cart }>('/api/cart/propose', { method: 'POST', body: JSON.stringify({ items, operation }) });
      setProposal(response.proposal); setCart(response.cart); setQuantityProduct(null);
    } catch (e) { const message = e instanceof Error ? e.message : t.error; setProposalError(message); if (!quantityProduct) setToast(message); }
    finally { setCartBusy(false); }
  }
  async function confirmCart() {
    if (!proposal || cartBusy) return;
    setCartBusy(true); setProposalError('');
    try { const data = await api<{ cart: Cart; cartUrl: string }>('/api/cart/confirm', { method: 'POST', body: JSON.stringify({ token: proposal.token, confirmed: true }) }); setCart(data.cart); setProposal(null); setToast(t.cartAdded); }
    catch (e) { setProposalError(e instanceof Error ? e.message : t.error); }
    finally { setCartBusy(false); }
  }
  function toggleCompare(product: Product) { setCompared(current => current.some(p => p.id === product.id) ? current.filter(p => p.id !== product.id) : [...current.slice(-3), product]); }
  function compareProducts() { void sendMessage(`${t.comparisonPrompt}\n${compared.map(product => `${product.name} (${product.sku})`).join('\n')}`, compared); }
  function reset() { abortRef.current?.abort(); requestId.current++; setSending(false); setMessages([]); setAttachments([]); setInput(''); setError(''); setResetConfirm(false); navigate('assistant'); }
  async function copyCartLink() { try { await navigator.clipboard.writeText(`${window.location.origin}/cart`); setCopied(true); setTimeout(() => setCopied(false), 3000); } catch { setToast(locale === 'ru' ? 'Ссылка на корзину: ' + window.location.origin + '/cart' : 'Себет сілтемесі: ' + window.location.origin + '/cart'); } }
  const card = (product: Product) => <ProductCard key={product.id} product={product} locale={locale} onDetails={openDetails} onAdd={chooseQuantity} onCompare={toggleCompare} compared={compared.some(p => p.id === product.id)} />;

  const composer = <div className="composer-wrap">
    {error && <div className="inline-error" role="alert"><CircleHelp size={17} /><span>{error}</span><button onClick={() => setError('')} aria-label={t.close}><X size={16} /></button></div>}
    <PromptBar locale={locale} input={input} onInput={setInput} attachments={attachments} onRemoveAttachment={index => setAttachments(current => current.filter((_, i) => i !== index))} onSubmit={text => void sendMessage(text)} onStop={stopSending} onAttach={() => fileRef.current?.click()} onNavigate={navigate} sending={sending} uploading={uploading} textareaRef={textareaRef} /><p className="composer-note"><ShieldCheck size={12} />{messages.length ? t.aiNote : t.composerHint}</p>
  </div>;

  return <div className="app-shell"><SmoothScroll />
    <input className="visually-hidden" type="file" accept="image/png,image/jpeg,image/webp,.pdf,.docx,.xlsx,.csv,.txt" multiple ref={fileRef} onChange={event => void uploadFiles(event.target.files)} tabIndex={-1} aria-label={t.attach} />


    <main className={`main-content view-${view} ${messages.length ? 'has-messages' : ''}`}>
      <header className="topbar topbar-full-width"><div className="topbar-left"><span className="breadcrumb">Jarvis <ChevronRight size={13} /> <span>{t[view]}</span></span></div><div className="topbar-right"><span className="connection"><i />{t.status}</span><div className="language-switch topbar-language" aria-label={locale === 'ru' ? 'Язык' : 'Тіл'}><button onClick={() => changeLocale('ru')} className={locale === 'ru' ? 'active' : ''} aria-pressed={locale === 'ru'}>Рус</button><button onClick={() => changeLocale('kk')} className={locale === 'kk' ? 'active' : ''} aria-pressed={locale === 'kk'}>Қаз</button></div><button className="topbar-new-chat" onClick={() => messages.length ? setResetConfirm(true) : navigate('assistant')}><Plus size={17} /><span>{t.newChat}</span></button><button className="top-cart" onClick={() => navigate('cart')} aria-label={`${t.cart}: ${cartCount}`}><ShoppingBag size={17} /><span>{t.cart}</span><b>{cartCount}</b></button></div></header><div className="prototype-nav-row"><GooeyNav active={view} onSelect={id => navigate(id as View)} items={[{ id: 'assistant', label: t.assistant, href: '/' }, { id: 'catalog', label: t.catalog, href: '/#catalog' }, { id: 'cart', label: t.cart, href: '/cart' }]} /></div>

      {view === 'assistant' && <>
        {messages.length === 0 ? <div className="welcome-view"><div className="hero original-hero"><div className="original-hero-field"><OriginalDotField /></div><div className="hero-glow" /><div className="hero-content"><div className="eyebrow"><span /><span>EKT INTELLIGENCE</span></div><DepthLogo text="Jarvis" fontSize="clamp(4.5rem, 10vw, 7rem)" /><h1>{t.welcome}</h1><p>{t.welcomeSub}</p><div className="original-hero-cta"><SpecularButton onClick={() => textareaRef.current?.focus()}>{locale === 'ru' ? 'Начать подбор' : 'Таңдауды бастау'}</SpecularButton></div></div><span className="hero-coordinate">43°14′ N / 76°53′ E</span><span className="hero-corner">J / 01</span></div>
          <div className="welcome-workspace">{composer}<div className="suggestion-grid">{[{ icon: Zap, name: t.select, sub: t.selectSub, action: () => void sendMessage(t.selectPrompt) }, { icon: GitCompareArrows, name: t.analog, sub: t.analogSub, action: () => void sendMessage(t.analogPrompt) }, { icon: FileText, name: t.specification, sub: t.specificationSub, action: () => fileRef.current?.click() }, { icon: Truck, name: t.terms, sub: t.termsSub, action: () => void sendMessage(t.termsPrompt) }].map((suggestion, i) => <button className="suggestion-card" key={suggestion.name} onClick={suggestion.action} style={{ animationDelay: `${i * 60}ms` }}><div className="suggestion-top"><suggestion.icon size={20} strokeWidth={1.5} /><ArrowUpRight size={15} /></div><strong>{suggestion.name}</strong><span>{suggestion.sub}</span></button>)}</div><div className="trust-row"><span><CheckCheck size={14} />{t.verified}</span><span><ShieldCheck size={14} />{t.secure}</span></div></div>
          <section className="catalog-preview"><div className="section-heading"><div><span className="section-kicker">01 / EKT</span><h2>{t.popular}</h2></div><button className="text-button" onClick={() => navigate('catalog')}>{t.explore}<ArrowRight size={16} /></button></div>{catalogLoading ? <div className="product-grid">{[1, 2, 3, 4].map(i => <div className="product-skeleton" key={i} />)}</div> : catalogError ? <div className="inline-error" role="alert">{catalogError}<button onClick={() => setCatalogRetry(i => i + 1)}>{t.retry}</button></div> : <div className="product-grid">{products.slice(0, 4).map(card)}</div>}</section>
          <section className="original-reveal-section"><ScrollReveal text={locale === 'ru' ? 'Каждый проект начинается с правильного выбора. Найдём ваше решение вместе.' : 'Әр жоба дұрыс таңдаудан басталады. Шешіміңізді бірге табайық.'} /></section><div className="original-marquee-section" aria-hidden="true"><ScrollVelocity text="EKF · IEK · Schneider Electric · ABB · Legrand · CHINT ·" baseVelocity={100} /><ScrollVelocity text={locale === 'ru' ? 'ЭЛЕКТРОТЕХНИКА · С ПОНИМАНИЕМ · JARVIS ·' : 'ЭЛЕКТРОТЕХНИКА · ТҮСІНІКТІ ТІЛДЕ · JARVIS ·'} baseVelocity={-100} /></div>
        </div> : <div className="conversation"><div className="message-list" aria-live="polite">{messages.map(message => <article className={`message message-${message.role}`} key={message.id}><div className="message-avatar">{message.role === 'assistant' ? <Zap size={17} fill="currentColor" /> : t.user.slice(0, 1)}</div><div className="message-content"><div className="message-author">{message.role === 'assistant' ? 'Jarvis' : t.user}{message.role === 'assistant' && <span>{message.mode === 'catalog' ? t.catalog : 'AI'}</span>}</div><MessageText text={message.content} />{message.attachments?.length ? <div className="message-attachments">{message.attachments.map((file, i) => <span key={i}><FileText size={13} />{file}</span>)}</div> : null}{!!message.products?.length && <div className="message-products">{message.products.map(card)}</div>}{!!message.sources?.length && <div className="message-sources"><span>{t.source}</span>{message.sources.filter(source => /^https?:\/\//i.test(source.url)).map((source, i) => <a key={i} href={source.url} target="_blank" rel="noopener noreferrer">{source.title}<ArrowUpRight size={11} /></a>)}</div>}{!!message.proposedItems?.length && <button className="primary-button message-proposal" disabled={cartBusy} onClick={() => void propose(message.proposedItems!)}><ShoppingBag size={16} />{t.confirmTitle}<ArrowRight size={16} /></button>}{!!message.suggestions?.length && <div className="followups">{message.suggestions.map(suggestion => <button key={suggestion} disabled={sending} onClick={() => void sendMessage(suggestion)}>{suggestion}<ArrowUpRight size={13} /></button>)}</div>}</div></article>)}{sending && <div className="thinking" role="status"><div className="message-avatar"><Zap size={17} fill="currentColor" /></div><div><span>{t.thinking}</span><div className="thinking-dots"><i /><i /><i /></div></div></div>}<div ref={messagesEnd} /></div><div className="conversation-composer">{composer}</div></div>}
      </>}

      {view === 'catalog' && <div className="catalog-page"><div className="page-intro"><span className="section-kicker">EKT / {t.catalog}</span><h1>{t.catalog}</h1><p>{t.catalogSub}</p></div><div className="catalog-toolbar"><label className="search-field"><Search size={19} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder={t.search} aria-label={t.search} />{query && <button className="icon-button" onClick={() => setQuery('')} aria-label={t.clear}><X size={16} /></button>}</label><span className="catalog-total">{catalogLoading ? t.loading : `${total} ${t.found}`}</span></div><div className="category-filters"><button className={!category ? 'active' : ''} onClick={() => setCategory('')}><SlidersHorizontal size={14} />{t.all}</button>{categories.slice(0, 12).map(item => <button className={category === item ? 'active' : ''} key={item} onClick={() => setCategory(category === item ? '' : item)}>{item}</button>)}</div>{catalogError ? <div className="empty-state"><CircleHelp size={34} /><p>{catalogError}</p><button className="secondary-button" onClick={() => setCatalogRetry(i => i + 1)}>{t.retry}</button></div> : catalogLoading ? <div className="product-grid">{Array.from({ length: 8 }, (_, i) => <div className="product-skeleton" key={i} />)}</div> : products.length ? <div className="product-grid">{products.map(card)}</div> : <div className="empty-state"><Search size={36} /><h2>{t.emptySearch}</h2><p>{t.trySearch}</p></div>}</div>}

      {view === 'cart' && <div className="cart-page"><div className="page-intro"><span className="section-kicker">JARVIS / {t.cart}</span><h1>{t.cartTitle}</h1><p>{t.cartSub}</p></div>{cartLoading ? <div className="empty-state"><LoaderCircle className="spin" size={30} /><p>{t.loading}</p></div> : cartError ? <div className="empty-state"><CircleHelp size={32} /><p>{cartError}</p><button className="secondary-button" onClick={() => void loadCart()}>{t.retry}</button></div> : !cart?.items.length ? <div className="empty-state cart-empty"><div className="empty-cart-icon"><ShoppingBag size={36} strokeWidth={1.3} /></div><h2>{t.cartEmpty}</h2><p>{t.cartEmptySub}</p><button className="primary-button" onClick={() => navigate('assistant')}>{t.backChat}<ArrowRight size={16} /></button></div> : <div className="cart-layout"><div className="cart-items">{cart.items.map(line => <article className="cart-line" key={line.product.id}><button className="cart-image-button" onClick={() => void openDetails(line.product)}><ProductImage product={line.product} /></button><div className="cart-line-main"><span className="product-sku">{line.product.sku}</span><button className="product-name" onClick={() => void openDetails(line.product)}>{line.product.name}</button><span className="cart-unit-price">{money(line.product.price, locale)} / {line.product.unit}</span><div className="cart-line-actions"><div className="quantity-stepper"><button disabled={cartBusy || line.quantity <= minimumQuantity(line.product)} onClick={() => void propose([{ productId: line.product.id, quantity: Number((line.quantity - minimumQuantity(line.product)).toFixed(6)) }], 'set')} aria-label={`${t.quantity} −1`}><Minus size={14} /></button><span>{line.quantity}</span><button disabled={cartBusy} onClick={() => void propose([{ productId: line.product.id, quantity: Number((line.quantity + minimumQuantity(line.product)).toFixed(6)) }], 'set')} aria-label={`${t.quantity} +1`}><Plus size={14} /></button></div><button className="icon-button" onClick={() => void propose([{ productId: line.product.id, quantity: line.quantity }], 'remove')} disabled={cartBusy} aria-label={`${t.remove}: ${line.product.name}`}><Trash2 size={16} /></button></div></div><strong className="cart-line-total">{money(line.product.price === null ? null : line.product.price * line.quantity, locale)}</strong></article>)}</div><aside className="cart-summary"><span className="section-kicker">{t.cart}</span><div className="cart-summary-count">{cart.items.length} {t.count}</div><div className="cart-total"><span>{t.total}</span><strong>{money(cart.total, locale)}</strong></div><button className="primary-button full-width" onClick={() => void copyCartLink()}>{copied ? <Check size={17} /> : <ShoppingBag size={17} />}{copied ? t.copied : t.cartLink}</button><p className="cart-link-note">{t.cartSession}</p>{cart.items.some(line => line.product.price === null) && <p className="small-note">{t.unknownPrices}</p>}<div className="cart-disclaimer"><ShieldCheck size={18} /><p>{t.cartPrototype}</p></div><a className="text-button" href="https://ekt.kz" target="_blank" rel="noopener noreferrer">{t.openEkt}<ArrowUpRight size={15} /></a></aside></div>}<div className="cart-bottom-note"><ShieldCheck size={16} />{t.cartPrototype}</div></div>}

      {compared.length > 0 && !proposal && <div className="comparison-bar"><GitCompareArrows size={19} /><span>{t.selected}: <strong>{compared.length}</strong></span><button className="text-button" onClick={() => setCompared([])}>{t.clear}</button><button className="primary-button" disabled={compared.length < 2 || sending} onClick={compareProducts}>{t.compareNow}<ArrowRight size={16} /></button></div>}
    </main>

    {detail && <Modal title={t.details} closeLabel={t.close} onClose={closeDetails} wide><div className="detail-top"><ProductImage product={detail} className="detail-image" /><div className="detail-overview"><span className="section-kicker">{detail.brand || 'EKT'}</span><h3>{detail.name}</h3><p className="product-sku">{t.sku}: {detail.sku}</p><div className={`stock ${detail.stock > 0 ? '' : 'no-stock'}`}><i />{detail.stock > 0 ? `${t.inStock} · ${detail.stock} ${detail.unit}` : t.unavailable}</div><strong className="detail-price">{money(detail.price, locale)}<small> / {detail.unit}</small></strong><button className="primary-button" disabled={detail.stock <= 0 || detailLoading} onClick={() => chooseQuantity(detail)}><Plus size={17} />{t.add}</button><button className="text-button" disabled={sending} onClick={() => { closeDetails(); void sendMessage(`${t.analogPrompt}\n${detail.name} (${detail.sku})`, [detail]); }}><GitCompareArrows size={15} />{t.findAnalog}</button></div></div>{detailLoading && <div className="detail-loading" role="status"><LoaderCircle size={15} className="spin" />{t.loading}</div>}{detail.description && <p className="detail-description">{detail.description}</p>}<section className="detail-section"><h3>{t.specifications}</h3>{Object.keys(detail.specs).length ? <dl className="spec-list">{Object.entries(detail.specs).map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}</dl> : <p className="muted">{t.noSpecs}</p>}</section>{detail.warehouses.length > 0 && <section className="detail-section"><h3>{t.warehouses}</h3><dl className="spec-list">{detail.warehouses.map((warehouse, i) => <div key={i}><dt>{warehouse.name}</dt><dd>{warehouse.stock} {detail.unit}</dd></div>)}</dl></section>}<section className="detail-section"><h3>{t.certificates}</h3>{detail.certificates.length ? detail.certificates.filter(cert => /^https?:\/\//i.test(cert.url)).map((certificate, i) => <a key={i} className="certificate-link" href={certificate.url} target="_blank" rel="noopener noreferrer"><FileText size={17} />{certificate.name}<ArrowUpRight size={15} /></a>) : <p className="muted">{t.noCerts}</p>}</section>{alternatives.length > 0 && <section className="detail-section"><h3>{t.analog}</h3><div className="detail-alternatives">{alternatives.slice(0, 3).map(product => <button key={product.id} onClick={() => void openDetails(product)}><span>{product.name}</span><ArrowUpRight size={16} /></button>)}</div></section>}<div className="detail-footer"><span>{detail.source === 'live' ? t.live : detail.source === 'snapshot' ? t.snapshot : t.demo} · {t.updated} {new Date(detail.fetchedAt).toLocaleString(locale === 'kk' ? 'kk-KZ' : 'ru-KZ')}</span>{/^https?:\/\//i.test(detail.url) && <a href={detail.url} target="_blank" rel="noopener noreferrer">{t.openEkt}<ArrowUpRight size={14} /></a>}</div></Modal>}

    {quantityProduct && <Modal title={t.selectQuantity} closeLabel={t.close} onClose={() => !cartBusy && setQuantityProduct(null)}><div className="quantity-product"><ProductImage product={quantityProduct} /><div><span className="product-sku">{quantityProduct.sku}</span><h3>{quantityProduct.name}</h3><strong>{money(quantityProduct.price, locale)} / {quantityProduct.unit}</strong></div></div><label className="quantity-input"><span>{t.quantity} ({quantityProduct.unit})</span><input type="number" min={minimumQuantity(quantityProduct)} max={quantityProduct.stock} step={minimumQuantity(quantityProduct)} value={quantity} onChange={event => setQuantity(Number(event.target.value))} autoFocus /></label><p className="muted">{t.inStock}: {quantityProduct.stock} {quantityProduct.unit}</p><div className="confirmation-total"><span>{t.total}</span><strong>{money(quantityProduct.price === null ? null : quantityProduct.price * quantity, locale)}</strong></div>{proposalError && <p className="inline-error" role="alert">{proposalError}</p>}<div className="modal-actions"><button className="secondary-button" disabled={cartBusy} onClick={() => setQuantityProduct(null)}>{t.cancel}</button><button className="primary-button" disabled={cartBusy || !validQuantity(quantity, quantityProduct)} onClick={() => void propose([{ productId: quantityProduct.id, quantity }])}>{cartBusy ? <LoaderCircle size={17} className="spin" /> : <ArrowRight size={17} />}{cartBusy ? t.pending : t.confirmTitle}</button></div></Modal>}

    {proposal && <Modal title={t.confirmTitle} closeLabel={t.close} onClose={() => !cartBusy && setProposal(null)}><p className="modal-description">{proposal.operation === 'remove' ? (locale === 'ru' ? 'Удалить эти товары из корзины?' : 'Осы тауарларды себеттен жою керек пе?') : t.confirmSub}</p><div className="proposal-items">{proposal.items.map(line => <div className="proposal-line" key={line.product.id}><ProductImage product={line.product} /><div><strong>{line.product.name}</strong><span>{line.quantity} {line.product.unit} × {money(line.product.price, locale)}</span></div><b>{money(line.product.price === null ? null : line.product.price * line.quantity, locale)}</b></div>)}</div>{proposal.operation !== 'remove' && <div className="confirmation-total"><span>{t.total}</span><strong>{money(proposal.items.reduce((sum, line) => sum + (line.product.price || 0) * line.quantity, 0), locale)}</strong></div>}{proposal.items.some(line => line.product.price === null) && <p className="small-note">{t.unknownPrices}</p>}<p className="small-note"><ShieldCheck size={14} />{t.cartPrototype}</p>{proposalError && <p className="inline-error" role="alert">{proposalError}</p>}<div className="modal-actions"><button className="secondary-button" disabled={cartBusy} onClick={() => setProposal(null)}>{t.cancel}</button><SpecularButton size="md" disabled={cartBusy} onClick={() => void confirmCart()}>{cartBusy ? <LoaderCircle className="spin" size={17} /> : <Check size={17} />}{t.confirm}</SpecularButton></div></Modal>}

    {resetConfirm && <Modal title={t.resetTitle} closeLabel={t.close} onClose={() => setResetConfirm(false)}><p className="modal-description">{t.resetSub}</p><div className="modal-actions"><button className="secondary-button" onClick={() => setResetConfirm(false)}>{t.cancel}</button><button className="primary-button" onClick={reset}>{t.resetConfirm}</button></div></Modal>}
    {toast && <div className="toast" role="status">{toast === t.cartAdded ? <Check size={16} /> : <CircleHelp size={16} />}<span>{toast}</span>{toast === t.cartAdded && <button onClick={() => { setToast(''); navigate('cart'); }}>{t.openCart}<ArrowRight size={14} /></button>}<button onClick={() => setToast('')} aria-label={t.close}><X size={14} /></button></div>}
  </div>;
}




