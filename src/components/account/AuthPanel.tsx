'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, CheckCircle2, LoaderCircle, LockKeyhole, Mail } from 'lucide-react';
import { authClient } from '@/lib/auth-client';
import { authErrorMessage } from '@/lib/auth-errors';
import type { Locale } from '@/lib/types';
import CodeSlots from '@/components/reactbits/CodeSlots';
import './account.css';

type Mode = 'sign-in' | 'sign-up' | 'verify' | 'forgot-password' | 'reset';
type ProviderError = { code?: string; status?: number };
const demoEnabled = process.env.NEXT_PUBLIC_DEMO_LOGIN_ENABLED === 'true';
export default function AuthPanel({ locale, path = 'sign-in', onSignedIn, embedded = false }: { locale: Locale; path?: string; onSignedIn?: () => void; embedded?: boolean }) {
  const router = useRouter(), ru = locale === 'ru', fieldId = useId();
  const [mode, setMode] = useState<Mode>(path === 'sign-up' ? 'sign-up' : ['forgot-password','reset-password'].includes(path) ? 'forgot-password' : 'sign-in');
  const [email, setEmail] = useState(''), [name, setName] = useState('');
  const [password, setPassword] = useState(''), [confirmation, setConfirmation] = useState('');
  const [code, setCode] = useState(''), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [verified, setVerified] = useState(false);
  const [codeRejected, setCodeRejected] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false), [resendAt, setResendAt] = useState(0), [remaining, setRemaining] = useState(0);
  const inFlight = useRef(false), mounted = useRef(true);
  useEffect(() => { mounted.current = true; setReady(true); return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    const tick = () => setRemaining(Math.max(0, Math.ceil((resendAt - Date.now()) / 1000)));
    tick(); if (!resendAt) return;
    const timer = setInterval(tick, 1000); return () => clearInterval(timer);
  }, [resendAt]);
  function change(next: Mode) { setMode(next); setError(''); setNotice(''); setPassword(''); setConfirmation(''); setCode(''); setVerified(false); setCodeRejected(false); }
  function failure(value: ProviderError) {
    if (!mounted.current) return;
    if ((mode === 'verify' || mode === 'reset') && /INVALID_OTP|OTP_EXPIRED|OTP_NOT_FOUND|VALIDATION_FAILED|BAD_JWT/.test((value.code || '').toUpperCase())) setCodeRejected(true);
    if (mode === 'sign-in' && /EMAIL_NOT_VERIFIED|EMAIL_NOT_CONFIRMED/.test((value.code || '').toUpperCase())) { setMode('verify'); setPassword(''); setCode(''); }
    setError(authErrorMessage(value, locale, mode === 'verify' || mode === 'reset'));
  }
  async function run(action: () => Promise<void>) {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError(''); setNotice('');
    try { await action(); } catch (error) { failure(error && typeof error === 'object' ? error as ProviderError : {}); }
    finally { inFlight.current = false; if (mounted.current) setBusy(false); }
  }
  async function sendCode(reset = mode === 'reset' || mode === 'forgot-password') {
    const result = reset ? await authClient.emailOtp.requestPasswordReset({ email: email.trim() }) : await authClient.emailOtp.sendVerificationOtp({ email: email.trim(), type: 'email-verification' });
    if (!mounted.current) return;
    if (result.error) { failure(result.error); return; }
    setResendAt(Date.now() + 60000); setCode('');
    setNotice(ru ? 'Код отправлен. Проверьте почту и папку «Спам».' : 'Код жіберілді. Пошта мен «Спам» қалтасын тексеріңіз.');
    if (reset) setMode('reset');
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if ((mode === 'sign-up' || mode === 'reset') && password !== confirmation) { setError(ru ? 'Пароли не совпадают.' : 'Құпиясөздер сәйкес емес.'); return; }
    if ((mode === 'verify' || mode === 'reset') && !/^\d{6}$/.test(code)) { setError(ru ? 'Введите все 6 цифр кода.' : 'Кодтың барлық 6 цифрын енгізіңіз.'); return; }
    await run(async () => {
      if (mode === 'sign-in') {
        const loginEmail = demoEnabled && email.trim() === 'user1' ? 'demo@jarvis-ekt.example' : email.trim();
        const result = await authClient.signIn.email({ email: loginEmail, password });
        if (!mounted.current) return;
        if (result.error) {
          if (result.error.code === 'EMAIL_NOT_VERIFIED') { setMode('verify'); setPassword(''); setCode(''); }
          failure(result.error); return;
        }
        if (!result.data?.user?.emailVerified) { setMode('verify'); setPassword(''); setCode(''); setNotice(ru ? 'Подтвердите email перед входом.' : 'Кіру алдында email мекенжайын растаңыз.'); return; }
        setPassword(''); router.refresh(); if (embedded) onSignedIn?.(); else router.push('/');
      } else if (mode === 'sign-up') {
        const result = await authClient.signUp.email({ email: email.trim(), password, name: name.trim() });
        if (!mounted.current) return;
        if (result.error) { failure(result.error); return; }
        setMode('verify'); setPassword(''); setConfirmation(''); setCode('');
        // Managed Neon has send_on_signup=true and email_verification_method='otp'.
        // Do not send another OTP here: that would invalidate the first email's code.
        setResendAt(Date.now() + 60000);
        setNotice(ru ? 'Код отправлен. Проверьте почту и папку «Спам».' : 'Код жіберілді. Пошта мен «Спам» қалтасын тексеріңіз.');
      } else if (mode === 'verify') {
        const result = await authClient.emailOtp.verifyEmail({ email: email.trim(), otp: code });
        if (!mounted.current) return;
        if (result.error) { failure(result.error); return; }
        // A provider may create a session on verification. Next login must prove the password.
        const logout = await authClient.signOut();
        if (!mounted.current) return;
        if (logout.error) { failure(logout.error); return; }
        setVerified(true); await new Promise(resolve => setTimeout(resolve, 650)); if (!mounted.current) return;
        change('sign-in'); setNotice(ru ? 'Email подтверждён. Теперь войдите с email и паролем.' : 'Email расталды. Енді email және құпиясөз арқылы кіріңіз.');
      } else if (mode === 'forgot-password') await sendCode(true);
      else {
        const result = await authClient.emailOtp.resetPassword({ email: email.trim(), otp: code, password });
        if (!mounted.current) return;
        if (result.error) { failure(result.error); return; }
        const logout = await authClient.signOut();
        if (!mounted.current) return;
        if (logout.error) { failure(logout.error); return; }
        setVerified(true); await new Promise(resolve => setTimeout(resolve, 650)); if (!mounted.current) return;
        change('sign-in'); setNotice(ru ? 'Пароль сохранён. Войдите с email и новым паролем.' : 'Құпиясөз сақталды. Email және жаңа құпиясөз арқылы кіріңіз.');
      }
    });
  }
  const codeStep = mode === 'verify' || mode === 'reset';
  const title = mode === 'sign-in' ? (ru ? 'Вход в Jarvis' : 'Jarvis-ке кіру') : mode === 'sign-up' ? (ru ? 'Создать аккаунт' : 'Аккаунт жасау') : mode === 'verify' ? (ru ? 'Подтвердите email' : 'Email мекенжайын растаңыз') : (ru ? 'Установить пароль' : 'Құпиясөз орнату');
  const submitText = mode === 'sign-in' ? (ru ? 'Войти' : 'Кіру') : mode === 'sign-up' ? (ru ? 'Создать аккаунт' : 'Аккаунт жасау') : mode === 'verify' ? (ru ? 'Подтвердить email' : 'Email растау') : mode === 'forgot-password' ? (ru ? 'Получить код' : 'Код алу') : (ru ? 'Сохранить пароль' : 'Құпиясөзді сақтау');
  return <section className="jarvis-auth-panel jarvis-password-auth" aria-label={title}>
    <div className="auth-symbol">{codeStep ? <Mail size={22} /> : <LockKeyhole size={22} />}</div><h2>{title}</h2>
    <p className="auth-intro">{mode === 'sign-in' ? (ru ? 'Ваши диалоги — в одном аккаунте.' : 'Диалогтарыңыз бір аккаунтта.') : mode === 'sign-up' ? (ru ? 'После регистрации подтвердите почту шестизначным кодом.' : 'Тіркелгеннен кейін поштаны алты таңбалы кодпен растаңыз.') : codeStep ? <>{ru ? 'Введите 6 цифр из письма для ' : 'Мына поштаға жіберілген 6 цифрды енгізіңіз: '}<strong>{email}</strong></> : (ru ? 'Раньше входили только по коду? Установите пароль через подтверждение почты. Этот же шаг поможет, если вы забыли пароль.' : 'Бұрын тек кодпен кірдіңіз бе? Поштаны растау арқылы құпиясөз орнатыңыз. Құпиясөзді ұмытсаңыз да осы қадам көмектеседі.')}</p>
    <form onSubmit={submit}><fieldset disabled={busy || !ready}>
      {mode === 'sign-up' && <label htmlFor={`${fieldId}-name`}>{ru ? 'Имя' : 'Атыңыз'}<input id={`${fieldId}-name`} name="name" autoComplete="name" required maxLength={100} value={name} onChange={event => setName(event.target.value)} /></label>}
      {!codeStep && <label htmlFor={`${fieldId}-email`}>{mode === 'sign-in' && demoEnabled ? (ru ? 'Email / логин' : 'Email / логин') : 'Email'}<input id={`${fieldId}-email`} name="email" type={mode === 'sign-in' && demoEnabled ? 'text' : 'email'} autoComplete={mode === 'sign-in' ? 'username' : 'email'} required maxLength={254} placeholder="you@example.com" value={email} onChange={event => setEmail(event.target.value)} /></label>}
      {codeStep && <CodeSlots value={code} onChange={value => { setCode(value); if (value) { setError(''); setCodeRejected(false); } }} length={6} slotSize={38} gap={7} disabled={busy || !ready} status={verified ? 'success' : codeRejected ? 'error' : 'idle'} ariaLabel={ru ? 'Код из письма, 6 цифр' : 'Поштадағы код, 6 цифр'} acceptedLabel={ru ? 'Код подтверждён' : 'Код расталды'} errorLabel={ru ? 'Проверьте код' : 'Кодты тексеріңіз'} countLabel={(entered,total) => ru ? `${entered} из ${total} цифр` : `${total} цифрдың ${entered} енгізілді`} />}
      {(mode === 'sign-in' || mode === 'sign-up' || mode === 'reset') && <label htmlFor={`${fieldId}-password`}>{mode === 'reset' ? (ru ? 'Новый пароль' : 'Жаңа құпиясөз') : (ru ? 'Пароль' : 'Құпиясөз')}<input id={`${fieldId}-password`} name="password" type="password" autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'} required minLength={8} maxLength={128} value={password} onChange={event => setPassword(event.target.value)} />{mode !== 'sign-in' && <small>{ru ? 'От 8 до 128 символов' : '8–128 таңба'}</small>}</label>}
      {(mode === 'sign-up' || mode === 'reset') && <label htmlFor={`${fieldId}-confirmation`}>{ru ? 'Повторите пароль' : 'Құпиясөзді қайталаңыз'}<input id={`${fieldId}-confirmation`} name="confirmPassword" type="password" autoComplete="new-password" required minLength={8} maxLength={128} value={confirmation} onChange={event => setConfirmation(event.target.value)} /></label>}
      {error && <p className="auth-error" role="alert">{error}</p>}{notice && <p className="auth-notice" role="status"><CheckCircle2 size={16} />{notice}</p>}
      <button className="auth-submit" type="submit" disabled={busy || (codeStep && code.length !== 6)}>{busy && <LoaderCircle size={17} className="spin" />}{submitText}</button>
    </fieldset></form>
    {codeStep && <button className="auth-text-action" disabled={busy || !ready || remaining > 0} onClick={() => void run(() => sendCode())}>{remaining ? `${ru ? 'Новый код через' : 'Жаңа код'} ${remaining} ${ru ? 'с' : 'с кейін'}` : resendAt ? (ru ? 'Отправить код ещё раз' : 'Кодты қайта жіберу') : (ru ? 'Получить код' : 'Код алу')}</button>}
    {mode === 'sign-in' && demoEnabled && <div className="auth-demo"><p>{ru ? 'Демо-вход: user1 / password123. Общий аккаунт — только тестовые данные.' : 'Демо кіру: user1 / password123. Ортақ аккаунт — тек сынақ деректері.'}</p><button disabled={busy || !ready} onClick={() => { setEmail('user1'); setPassword('password123'); setError(''); }}>{ru ? 'Заполнить демо-данные' : 'Демо деректерін толтыру'}</button></div>}
    {mode === 'sign-in' ? <div className="auth-navigation"><button disabled={busy || !ready} onClick={() => change('forgot-password')}>{ru ? 'Установить / восстановить пароль' : 'Құпиясөз орнату / қалпына келтіру'}</button><p>{ru ? 'Нет аккаунта?' : 'Аккаунтыңыз жоқ па?'} <button disabled={busy || !ready} onClick={() => change('sign-up')}>{ru ? 'Регистрация' : 'Тіркелу'}</button></p></div> : <button className="auth-text-action auth-back" disabled={busy || !ready} onClick={() => change('sign-in')}><ArrowLeft size={14} />{ru ? 'Вернуться ко входу' : 'Кіруге оралу'}</button>}
  </section>;
}
