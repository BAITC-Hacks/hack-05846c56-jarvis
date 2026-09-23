import { NextRequest, NextResponse } from 'next/server';
import { AccountError, requireAccountUser } from '@/lib/auth-server';
import { listHistory, saveHistory } from '@/lib/history-store';
import { saveHistorySchema } from '@/lib/history-types';
import { historyFailure, historyOrigin } from '@/lib/history-http';
export const runtime = 'nodejs';
export const maxDuration = 30;

export async function GET() {
  try { const user = await requireAccountUser(); const conversations = await listHistory(user.id); return NextResponse.json({ user, conversations }, { headers: { 'Cache-Control': 'no-store' } }); }
  catch (error) { return historyFailure(error); }
}
export async function POST(request: NextRequest) {
  try {
    historyOrigin(request); const user = await requireAccountUser();
    if (!request.headers.get('content-type')?.includes('application/json')) throw new AccountError('Ожидается JSON / JSON қажет', 415, 'INVALID_BODY');
    if (Number(request.headers.get('content-length') || 0) > 450000) throw new AccountError('Диалог слишком большой / Диалог тым үлкен', 413, 'HISTORY_TOO_LARGE');
    const text = await request.text();
    if (Buffer.byteLength(text, 'utf8') > 450000) throw new AccountError('Диалог слишком большой / Диалог тым үлкен', 413, 'HISTORY_TOO_LARGE');
    let body: unknown; try { body = JSON.parse(text); } catch { throw new AccountError('Некорректный запрос / Қате сұрау', 400, 'INVALID_BODY'); }
    const parsed = saveHistorySchema.safeParse(body);
    if (!parsed.success) throw new AccountError('Проверьте формат диалога / Диалог пішімін тексеріңіз', 400, 'INVALID_HISTORY');
    const conversation = await saveHistory(user.id, parsed.data);
    return NextResponse.json({ conversation }, { status: parsed.data.id ? 200 : 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return historyFailure(error); }
}
