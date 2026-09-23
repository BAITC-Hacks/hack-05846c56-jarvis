import { notFound } from 'next/navigation';
import { authViewPaths } from '@neondatabase/auth-ui/server';
import AuthScreen from '@/components/account/AuthScreen';
export default async function AuthPage({ params }: { params: Promise<{ path: string }> }) {
  const { path } = await params;
  if (!Object.values(authViewPaths).includes(path)) notFound();
  return <AuthScreen path={path} />;
}
