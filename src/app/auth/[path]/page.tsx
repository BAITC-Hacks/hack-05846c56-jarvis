import { notFound } from 'next/navigation';
import AuthScreen from '@/components/account/AuthScreen';
export default async function AuthPage({ params }: { params: Promise<{ path: string }> }) {
  const { path } = await params;
  if (!['sign-in', 'sign-up', 'forgot-password', 'reset-password'].includes(path)) notFound();
  return <AuthScreen path={path} />;
}
