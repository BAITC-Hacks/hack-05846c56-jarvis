import 'server-only';
import { createNeonAuth } from '@neondatabase/auth/next/server';
import type { AccountUser } from './history-types';

let instance: ReturnType<typeof createNeonAuth> | undefined;
export class AccountError extends Error {
  constructor(message: string, public status = 503, public code = 'ACCOUNT_UNAVAILABLE') { super(message); this.name = 'AccountError'; }
}
export function getAuth() {
  if (instance) return instance;
  const baseUrl = process.env.NEON_AUTH_BASE_URL;
  const secret = process.env.NEON_AUTH_COOKIE_SECRET;
  if (!baseUrl || !secret || secret.length < 32) throw new AccountError('Вход пока недоступен. Попробуйте позже / Кіру әзірге қолжетімсіз. Кейінірек көріңіз');
  instance = createNeonAuth({ baseUrl, cookies: { secret, sessionDataTtl: 60 } });
  return instance;
}
/** Called by every history endpoint; browser input never supplies the owner. */
export async function requireAccountUser(): Promise<AccountUser> {
  const result = await getAuth().getSession();
  if (result.error) throw new AccountError('Не удалось проверить сессию / Сессияны тексеру мүмкін болмады');
  const session = result.data;
  if (!session?.user?.id) throw new AccountError('Войдите, чтобы открыть историю / Тарихты ашу үшін кіріңіз', 401, 'SIGN_IN_REQUIRED');
  if (session.user.emailVerified !== true) throw new AccountError('Подтвердите почту, чтобы открыть историю / Тарихты ашу үшін поштаңызды растаңыз', 403, 'EMAIL_NOT_VERIFIED');
  return { id: session.user.id, email: session.user.email || '', name: session.user.name || '' };
}
