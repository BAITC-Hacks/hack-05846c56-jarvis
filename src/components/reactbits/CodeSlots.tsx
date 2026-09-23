'use client';

// Adapted from the exact CodeSlots JSX/CSS supplied by the user (React Bits).
// Original slot springs, gliding caret, success wash and error cascade retained.
import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ClipboardEvent, type ChangeEvent, type PointerEvent } from 'react';
import { animate, motion, motionValue, useMotionValue, useReducedMotion, useTransform, type MotionValue } from 'motion/react';
import { Check } from 'lucide-react';
import './CodeSlots.css';

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const WASH_IN = 0.3, WASH_OUT = 0.2, SINK_DELAY = 0.06, SINK_STEP = 0.03, CHECK_DELAY = 0.28, CHECK_RISE = 8, SINK_FADE = 0.6;
const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const digitsOf = (raw: unknown) => String(raw ?? '').replace(/\D/g, '');
const toSlots = (raw: unknown, count: number) => { const digits = digitsOf(raw).slice(0, count); return Array.from({ length: count }, (_, i) => digits[i] ?? ''); };
const firstEmptyOf = (slots: string[]) => { const index = slots.indexOf(''); return index === -1 ? slots.length - 1 : index; };
const isFull = (slots: string[]) => slots.every(Boolean);

export interface CodeSlotsProps {
  length?: number; value?: string; defaultValue?: string;
  onChange?: (code: string) => void; onComplete?: (code: string) => void;
  status?: 'idle' | 'error' | 'success'; mask?: boolean; caret?: boolean;
  disabled?: boolean; autoFocus?: boolean; accentColor?: string; inkColor?: string;
  slotColor?: string; digitColor?: string; dangerColor?: string; slotSize?: number;
  gap?: number; radius?: number; bounce?: number; settle?: number; rise?: number;
  cascade?: number; ariaLabel?: string; acceptedLabel?: string; errorLabel?: string;
  countLabel?: (entered: number, total: number) => string; className?: string;
}

export default function CodeSlots({ length: requestedLength = 6, value, defaultValue = '', onChange, onComplete, status = 'idle', mask = false, caret = true, disabled = false, autoFocus = false, accentColor = '#f5f5f5', inkColor = '#f5f5f5', slotColor = '#27272a', digitColor = '#18181b', dangerColor = '#ff3b30', slotSize = 44, gap = 8, radius = 12, bounce = 0.2, settle = 0.3, rise = 8, cascade = 20, ariaLabel = 'Код подтверждения', acceptedLabel = 'Код принят', errorLabel = 'Неверный код. Введите новый код.', countLabel = (entered, total) => `Введено цифр: ${entered} из ${total}`, className = '' }: CodeSlotsProps) {
  const length = Math.max(1, Math.min(12, Math.floor(requestedLength) || 6));
  const uid = useId(), reduce = useReducedMotion(), inputRef = useRef<HTMLInputElement>(null), rowRef = useRef<HTMLDivElement>(null);
  const [slots, setSlots] = useState(() => toSlots(value ?? defaultValue, length));
  const [active, setActive] = useState(() => firstEmptyOf(slots)), [focused, setFocused] = useState(false), [veiled, setVeiled] = useState(status === 'success'), [draining, setDraining] = useState(false);
  const activeMv = useMotionValue(active), openMv = useMotionValue(status === 'success' ? 1 : 0), checkMv = useMotionValue(status === 'success' ? 1 : 0);
  const glide = useRef(new Set<number>()), target = useRef<number[]>([]), drainTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined), statusRef = useRef(status), emitted = useRef(digitsOf(value ?? defaultValue).slice(0, length)), slotsRef = useRef(slots), completed = useRef('');
  slotsRef.current = slots;
  const callbacks = useRef({ onChange, onComplete }); callbacks.current = { onChange, onComplete };
  const live = useRef({ settle, bounce, cascade, reduce }); live.current = { settle, bounce, cascade, reduce };
  const springs = useMemo(() => ({ mvs: Array.from({ length }, (_, i) => motionValue(slotsRef.current[i] ? 1 : 0)), drops: Array.from({ length }, () => motionValue(statusRef.current === 'success' ? 1 : 0)) }), [length]);
  const { mvs, drops } = springs, pitch = slotSize + gap, height = Math.round(slotSize * 1.18), washRadius = Math.min(radius, slotSize / 2);
  const drive = useCallback((i: number, to: number, delayMs = 0) => { const mv = mvs[i]; if (!mv) return; target.current[i] = to; const settings = live.current; if (settings.reduce) { mv.jump(to); return; } animate(mv, to, { type: 'spring', duration: settings.settle, bounce: settings.bounce, delay: delayMs / 1000 }); }, [mvs]);
  const land = useCallback((i: number, delayMs = 0) => { if (mvs[i]?.get() > 0) mvs[i].jump(0); drive(i, 1, delayMs); }, [mvs, drive]);
  const moveActive = useCallback((next: number, crossed: number[]) => { crossed.forEach(index => glide.current.add(index)); activeMv.jump(next); setActive(next); }, [activeMv]);
  const jumpActive = useCallback((next: number) => { glide.current.clear(); activeMv.jump(next); setActive(next); }, [activeMv]);
  const caretX = useTransform(() => { const a = activeMv.get(); let x = a * pitch; for (let j = 0; j < mvs.length; j++) { const h = clamp01(mvs[j].get()); if (!glide.current.has(j)) continue; const to = target.current[j]; if (to === undefined || h === clamp01(to)) { glide.current.delete(j); continue; } x += j < a ? -(1 - h) * pitch : h * pitch; } return Math.min(Math.max(x, 0), (mvs.length - 1) * pitch); });
  const caretTransform = useTransform(caretX, x => `translateX(${x}px)`), washClip = useTransform(openMv, o => `inset(0 ${(1 - clamp01(o)) * 50}% round ${washRadius}px)`), checkTransform = useTransform(checkMv, c => `translateY(${(1 - c) * CHECK_RISE}px) scale(${0.85 + 0.15 * Math.max(c, 0)})`), checkOpacity = useTransform(checkMv, clamp01);
  const commit = useCallback((next: string[]) => {
    slotsRef.current = next; setSlots(next); const code = next.join('');
    if (code !== emitted.current) { emitted.current = code; callbacks.current.onChange?.(code); }
    if (!isFull(next)) completed.current = '';
    else if (completed.current !== code) { completed.current = code; callbacks.current.onComplete?.(code); }
  }, []);
  const insert = (raw: string, from = active) => { const digits = digitsOf(raw); if (!digits) return; const next = [...slotsRef.current], crossed: number[] = [], step = reduce ? 0 : cascade; let i = from; for (const ch of digits) { if (i >= length) break; next[i] = ch; land(i, (i - from) * step); crossed.push(i); i++; } if (!crossed.length) return; commit(next); moveActive(Math.min(i, length - 1), crossed); };
  const clearSlot = (i: number, stepBack = false) => { if (!slotsRef.current[i]) { if (stepBack) jumpActive(i); return; } const next = [...slotsRef.current]; next[i] = ''; drive(i, 0); commit(next); if (stepBack) moveActive(i, [i]); };
  const busy = disabled || draining || status === 'success';
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (busy || event.metaKey || event.ctrlKey || event.altKey) return;
    const key = event.key;
    if (/^[0-9]$/.test(key)) { event.preventDefault(); insert(key); }
    else if (key === 'Backspace') { event.preventDefault(); if (slotsRef.current[active]) clearSlot(active); else if (active > 0) clearSlot(active - 1, true); }
    else if (key === 'Delete') { event.preventDefault(); clearSlot(active); }
    else if (key === 'ArrowLeft') { event.preventDefault(); jumpActive(Math.max(active - 1, 0)); }
    else if (key === 'ArrowRight') { event.preventDefault(); jumpActive(Math.min(active + 1, length - 1)); }
    else if (key === 'Home') { event.preventDefault(); jumpActive(0); }
    else if (key === 'End') { event.preventDefault(); jumpActive(length - 1); }
  };
  const onPaste = (event: ClipboardEvent<HTMLInputElement>) => { event.preventDefault(); if (!busy) { const digits = digitsOf(event.clipboardData.getData('text')); insert(digits, digits.length >= length ? 0 : active); } };
  // A real native input value supports mobile deletion, OTP autofill and assistive technology.
  // Desktop key events retain the original individual-slot editing behavior.
  const onInput = (event: ChangeEvent<HTMLInputElement>) => {
    if (busy) return;
    const next = toSlots(event.target.value, length), prev = slotsRef.current;
    next.forEach((ch, i) => { if (ch !== prev[i]) { if (ch) land(i, reduce ? 0 : i * cascade); else drive(i, 0); } });
    commit(next); moveActive(firstEmptyOf(next), next.map((_, index) => index));
  };
  const onRowPointerDown = (event: PointerEvent<HTMLDivElement>) => { if (busy) return; event.preventDefault(); const row = rowRef.current; if (row) { const rect = row.getBoundingClientRect(), zoom = rect.width / (row.offsetWidth || rect.width) || 1, i = Math.floor((event.clientX - rect.left) / zoom / pitch); jumpActive(Math.max(0, Math.min(i, firstEmptyOf(slotsRef.current)))); } inputRef.current?.focus(); };

  useEffect(() => { glide.current.clear(); target.current = []; const next = Array.from({ length }, (_, i) => slotsRef.current[i] ?? ''); slotsRef.current = next; setSlots(next); jumpActive(firstEmptyOf(next)); const code = next.join(''); if (code !== emitted.current) { emitted.current = code; callbacks.current.onChange?.(code); } }, [length, jumpActive]);
  useEffect(() => {
    if (value === undefined) return; const clean = digitsOf(value).slice(0, length); if (clean === emitted.current) return;
    emitted.current = clean; completed.current = ''; const prev = slotsRef.current, next = toSlots(clean, length), hidden = statusRef.current === 'success', landing: number[] = [], leaving: number[] = [];
    next.forEach((ch, i) => { if (ch !== prev[i]) (ch ? landing : leaving).push(i); });
    const step = live.current.reduce || hidden ? 0 : live.current.cascade;
    landing.forEach((i, k) => land(i, k * step)); leaving.reverse().forEach((i, k) => { if (hidden) { target.current[i] = 0; mvs[i].jump(0); drops[i].jump(0); } else drive(i, 0, k * step); });
    slotsRef.current = next; setSlots(next); moveActive(firstEmptyOf(next), [...landing, ...leaving]);
    // Controlled echoes/programmatic restoration never trigger verification.
  }, [value, length, land, drive, mvs, drops, moveActive]);
  useEffect(() => {
    const was = statusRef.current; statusRef.current = status; let cancelled = false;
    openMv.stop(); checkMv.stop(); drops.forEach(drop => drop.stop());
    if (status === 'success') {
      setVeiled(true);
      if (reduce) { openMv.jump(1); drops.forEach(drop => drop.jump(1)); checkMv.jump(1); }
      else { animate(openMv, 1, { duration: WASH_IN, ease: EASE_OUT }); drops.forEach((drop, k) => animate(drop, 1, { type: 'spring', duration: 0.3, bounce: 0, delay: SINK_DELAY + k * SINK_STEP })); animate(checkMv, 1, { type: 'spring', duration: 0.35, bounce, delay: CHECK_DELAY }); }
    } else if (was === 'success' || veiled) {
      if (reduce) { openMv.jump(0); checkMv.jump(0); drops.forEach(drop => drop.jump(0)); setVeiled(false); }
      else { animate(checkMv, 0, { duration: 0.15, ease: EASE_OUT }); animate(openMv, 0, { duration: WASH_OUT, ease: EASE_OUT, delay: 0.06 }).then(() => { if (!cancelled) setVeiled(false); }); drops.forEach(drop => animate(drop, 0, { type: 'spring', duration: 0.3, bounce: 0, delay: 0.1 })); }
    }
    return () => { cancelled = true; openMv.stop(); checkMv.stop(); drops.forEach(drop => drop.stop()); };
    // veiled is animation bookkeeping, not a new animation trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, reduce, bounce, openMv, checkMv, drops]);
  useEffect(() => {
    clearTimeout(drainTimer.current); setDraining(false);
    if (status !== 'error') return;
    const filled = slotsRef.current.map((char, i) => char ? i : -1).filter(i => i >= 0).reverse(); if (!filled.length) return;
    setDraining(true); const settings = live.current, step = settings.reduce ? 0 : settings.cascade;
    filled.forEach((i, k) => drive(i, 0, k * step)); moveActive(0, slotsRef.current.map((_, j) => j));
    drainTimer.current = setTimeout(() => { setDraining(false); commit(Array.from({ length }, () => '')); }, settings.reduce ? 0 : (filled.length - 1) * step + settings.settle * 1000);
    return () => clearTimeout(drainTimer.current);
  }, [status, length, drive, moveActive, commit]);
  useEffect(() => () => { clearTimeout(drainTimer.current); mvs.forEach(mv => mv.stop()); drops.forEach(drop => drop.stop()); }, [mvs, drops]);
  useEffect(() => { if (autoFocus && !disabled) inputRef.current?.focus(); }, [autoFocus, disabled]);
  useEffect(() => { if (!focused) return; const before = slots.slice(0, active).filter(Boolean).length; inputRef.current?.setSelectionRange(before, before + (slots[active] ? 1 : 0)); }, [active, focused, slots]);
  const view = slots.length === length ? slots : Array.from({ length }, (_, i) => slots[i] ?? '');
  const showCaret = caret && focused && !busy && !veiled && (status === 'error' || !view[active]);
  return <div className={`code-slots${className ? ` ${className}` : ''}`} style={{ '--cs-accent': accentColor, '--cs-ink': inkColor, '--cs-slot': slotColor, '--cs-digit': digitColor, '--cs-danger': dangerColor, '--cs-size': `${slotSize}px`, '--cs-height': `${height}px`, '--cs-gap': `${gap}px`, '--cs-radius': `${Math.min(radius, slotSize / 2)}px`, '--cs-font': `${Math.round(slotSize * 0.5)}px` } as CSSProperties}>
    <div ref={rowRef} className="code-slots__row" data-status={status} data-focused={focused ? '' : undefined} data-disabled={disabled ? '' : undefined} onPointerDown={onRowPointerDown}>
      <input ref={inputRef} className="code-slots__input" type={mask ? 'password' : 'text'} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" value={view.join('')} maxLength={length} aria-label={ariaLabel} aria-invalid={status === 'error'} aria-describedby={`${uid}-count`} aria-busy={draining} disabled={disabled} readOnly={draining || status === 'success'} onKeyDown={onKeyDown} onPaste={onPaste} onChange={onInput} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} />
      {view.map((char, i) => <Slot key={i} mv={mvs[i]} drop={drops[i]} char={mask && char ? '•' : char} active={focused && i === active} rise={rise} sink={Math.round(height * 0.5)} />)}
      <motion.span className="code-slots__wash" aria-hidden="true" style={{ clipPath: washClip }}><motion.span className="code-slots__check" style={{ transform: checkTransform, opacity: checkOpacity }}><Check size={Math.round(slotSize * 0.6)} strokeWidth={2.2} /></motion.span></motion.span>
      <motion.span className="code-slots__caret" aria-hidden="true" data-show={showCaret ? '' : undefined} style={{ transform: caretTransform }}><span key={active} className="code-slots__caret-line" /></motion.span>
    </div>
    <span id={`${uid}-count`} className="code-slots__sr" aria-live="polite">{status === 'success' ? acceptedLabel : status === 'error' ? errorLabel : countLabel(view.filter(Boolean).length, length)}</span>
  </div>;
}

function Slot({ mv, drop, char, active, rise, sink }: { mv: MotionValue<number>; drop: MotionValue<number>; char: string; active: boolean; rise: number; sink: number }) {
  const [shown, setShown] = useState(char);
  useEffect(() => { if (char) setShown(char); }, [char]);
  const fill = useTransform(mv, t => `scale(${Math.max(t, 0)})`), lift = useTransform([mv, drop], ([t, d]: number[]) => `translateY(${(1 - t) * rise + Math.max(d, 0) * sink}px)`), ink = useTransform([mv, drop], ([t, d]: number[]) => clamp01(t) * (1 - clamp01(d / SINK_FADE)));
  return <span className="code-slots__slot" data-active={active ? '' : undefined} data-filled={char ? '' : undefined} aria-hidden="true"><motion.span className="code-slots__fill" style={{ transform: fill }} />{shown ? <motion.span className="code-slots__digit" style={{ transform: lift, opacity: ink }}>{shown}</motion.span> : null}</span>;
}
