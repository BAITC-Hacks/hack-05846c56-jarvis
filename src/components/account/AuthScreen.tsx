'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import AuthPanel from './AuthPanel';
import type { Locale } from '@/lib/types';
export default function AuthScreen({ path }: { path: string }) {
  const [locale, setLocale] = useState<Locale>('ru');
  useEffect(() => { try { if (localStorage.getItem('jarvis-locale') === 'kk') setLocale('kk'); } catch { /* optional preference */ } }, []);
  return <main className="jarvis-auth-screen"><Link href="/" className="text-button"><ArrowLeft size={16} />{locale === 'ru' ? 'Вернуться к Jarvis' : 'Jarvis-ке оралу'}</Link><AuthPanel locale={locale} path={path} /></main>;
}
