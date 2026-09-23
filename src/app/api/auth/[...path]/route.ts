import { AccountError, getAuth } from '@/lib/auth-server';
import { AuthPolicyError, authPath, guardAuthOwner, guardAuthTarget, protectAuthOrigin, readAuthBody, requiresDemoSessionCheck } from '@/lib/auth-policy';
export const runtime = 'nodejs';
export const maxDuration = 30;
type Context = { params: Promise<{ path: string[] }> };
function failure(error: unknown) {
  const known = error instanceof AuthPolicyError || error instanceof AccountError;
  const message = known ? error.message : 'Вход временно недоступен. Повторите / Кіру уақытша қолжетімсіз. Қайталаңыз';
  return Response.json({ error: message, message, code: known ? error.code : 'AUTH_UNAVAILABLE' }, { status: known ? error.status : 503, headers: { 'Cache-Control': 'no-store' } });
}
async function protectOwner(path: string) {
  if (!requiresDemoSessionCheck(path)) return;
  const session = await getAuth().getSession();
  if (session.error) throw new AccountError('Не удалось проверить сессию / Сессияны тексеру мүмкін болмады');
  guardAuthOwner(path, session.data?.user);
}
function noStore(response: Response) { response.headers.set('Cache-Control', 'no-store'); return response; }
export async function GET(request: Request, context: Context) {
  try {
    const path = authPath((await context.params).path);
    guardAuthTarget(path); await protectOwner(path);
    return noStore(await getAuth().handler().GET(request, context));
  } catch (error) { return failure(error); }
}
export async function POST(request: Request, context: Context) {
  try {
    protectAuthOrigin(request);
    const path = authPath((await context.params).path), body = await readAuthBody(request);
    guardAuthTarget(path, body); await protectOwner(path);
    return noStore(await getAuth().handler().POST(request, context));
  } catch (error) { return failure(error); }
}
