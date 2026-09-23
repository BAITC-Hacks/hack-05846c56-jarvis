'use client';
import { AuthView, NeonAuthUIProvider } from '@neondatabase/auth-ui';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { authClient } from '@/lib/auth-client';
import { authLocalization } from '@/lib/auth-localization';
import type { Locale } from '@/lib/types';
import '@neondatabase/auth-ui/css';
import './account.css';

export default function AuthPanel({ locale, path = 'sign-in', onSignedIn, embedded = false }: { locale: Locale; path?: string; onSignedIn?: () => void; embedded?: boolean }) {
  const router = useRouter();
  const [activePath, setActivePath] = useState(path);
  function navigate(url: string) {
    if (embedded && url.startsWith('/auth/')) { setActivePath(url.split('/auth/')[1].split('?')[0]); return; }
    if (embedded && url === '/') { onSignedIn?.(); return; }
    router.push(url);
  }
  return <div className="jarvis-auth-panel"><NeonAuthUIProvider authClient={authClient} defaultTheme="dark" navigate={navigate} replace={navigate} onSessionChange={() => { router.refresh(); onSignedIn?.(); }} redirectTo="/" emailOTP localization={authLocalization[locale]}><AuthView path={embedded ? activePath : path} redirectTo="/" localization={authLocalization[locale]} /></NeonAuthUIProvider></div>;
}
