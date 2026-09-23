/** Local proxy policy only. The external Neon Auth provider has its own settings. */
export const DEMO_EMAIL = 'demo@jarvis-ekt.example';
export const AUTH_BODY_LIMIT = 32 * 1024;
export class AuthPolicyError extends Error {
  constructor(message: string, public status = 403, public code = 'AUTH_POLICY') { super(message); this.name = 'AuthPolicyError'; }
}
const demoMessage = 'Демоаккаунт доступен только для входа. Его данные нельзя изменять / Демоаккаунт тек кіруге арналған. Оның деректерін өзгертуге болмайды';
const passwordOnly = 'Используйте вход по почте и паролю / Пошта және құпиясөз арқылы кіріңіз';
const demoEmailActions = new Set([
  'sign-up/email', 'request-password-reset', 'forget-password', 'reset-password',
  'email-otp/send-verification-otp', 'email-otp/request-password-reset', 'email-otp/forget-password',
  'email-otp/reset-password', 'email-otp/passcode', 'email-otp/verify-email',
  'send-verification-email', 'verify-email',
]);
// Installed SDK uses link-social; include link-account aliases and unlink to avoid
// enabling a second credential path or removing the demo account's password.
const ownerActions = new Set([
  'change-password', 'set-password', 'update-user', 'delete-user', 'change-email',
  'link-account', 'link-social', 'unlink-account', 'reset-password',
  'email-otp/reset-password', 'email-otp/passcode',
]);
export function isDemoEmail(value: unknown): boolean { return typeof value === 'string' && value.trim().toLowerCase() === DEMO_EMAIL; }
export function authPath(parts: string[]): string {
  // Preserve opaque reset/callback tokens (base64url etc.) while disallowing
  // separators or dot-segments that could make the guard and proxy disagree.
  if (!parts.length || parts.some(part => !/^[a-z0-9._~-]+$/i.test(part) || part === '.' || part === '..')) throw new AuthPolicyError('Некорректный путь запроса / Сұрау жолы дұрыс емес', 400, 'INVALID_AUTH_PATH');
  return parts.join('/').toLowerCase();
}
export function protectAuthOrigin(request: Request): void {
  const origin = request.headers.get('origin');
  const url = new URL(request.url);
  // Next dev can expose its bind address (0.0.0.0) in request.url. Host retains
  // the requested app origin; forwarded headers supplied by callers are ignored.
  const expected = `${url.protocol}//${request.headers.get('host') || url.host}`;
  if ((origin !== null && origin !== expected) || request.headers.get('sec-fetch-site') === 'cross-site') throw new AuthPolicyError('Недопустимый источник запроса / Сұрау көзі жарамсыз', 403, 'INVALID_ORIGIN');
}
export async function readAuthBody(request: Request): Promise<Record<string, unknown>> {
  if (Number(request.headers.get('content-length') || 0) > AUTH_BODY_LIMIT) throw new AuthPolicyError('Запрос слишком большой / Сұрау тым үлкен', 413, 'AUTH_BODY_TOO_LARGE');
  const clone = request.clone(), reader = clone.body?.getReader();
  if (!reader) return {};
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > AUTH_BODY_LIMIT) { void reader.cancel().catch(() => {}); throw new AuthPolicyError('Запрос слишком большой / Сұрау тым үлкен', 413, 'AUTH_BODY_TOO_LARGE'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  if (size === 0) return {};
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') || '')) throw new AuthPolicyError('Ожидается JSON / JSON күтілуде', 415, 'INVALID_AUTH_CONTENT_TYPE');
  try {
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    const body: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('object required');
    return body as Record<string, unknown>;
  } catch { throw new AuthPolicyError('Некорректный JSON / JSON дұрыс емес', 400, 'INVALID_AUTH_BODY'); }
}
export function guardAuthTarget(path: string, body: Record<string, unknown> = {}): void {
  if (path === 'sign-in/email-otp' || path === 'sign-in/magic-link' || path === 'magic-link/verify') throw new AuthPolicyError(passwordOnly, 403, 'PASSWORD_SIGN_IN_REQUIRED');
  if (demoEmailActions.has(path) && isDemoEmail(body.email)) throw new AuthPolicyError(demoMessage, 403, 'DEMO_ACCOUNT_READ_ONLY');
  // Verification OTP is still enabled for ordinary registration and recovery,
  // while requesting a passwordless sign-in OTP through this proxy is disabled.
  if (path === 'email-otp/send-verification-otp' && body.type === 'sign-in') throw new AuthPolicyError(passwordOnly, 403, 'PASSWORD_SIGN_IN_REQUIRED');
}
export function requiresDemoSessionCheck(path: string): boolean { return ownerActions.has(path) || path.startsWith('delete-user/'); }
/** Caller must supply the verified provider session; never pass a body user/id. */
export function guardAuthOwner(path: string, trustedUser: { email?: string | null } | null | undefined): void {
  if (requiresDemoSessionCheck(path) && isDemoEmail(trustedUser?.email)) throw new AuthPolicyError(demoMessage, 403, 'DEMO_ACCOUNT_READ_ONLY');
}
