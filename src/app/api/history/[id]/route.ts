import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { AccountError, requireAccountUser } from '@/lib/auth-server';
import { deleteHistory, readHistory } from '@/lib/history-store';
import { historyFailure, historyOrigin } from '@/lib/history-http';
export const runtime = 'nodejs';
export const maxDuration = 30;
type Context = { params: Promise<{ id: string }> };
async function validId(context: Context) { const { id } = await context.params; if (!z.string().uuid().safeParse(id).success) throw new AccountError('Диалог не найден / Диалог табылмады', 404, 'HISTORY_NOT_FOUND'); return id; }
export async function GET(_request: NextRequest, context: Context) {
  try { const user = await requireAccountUser(); const id = await validId(context); const conversation = await readHistory(user.id, id); if (!conversation) throw new AccountError('Диалог не найден / Диалог табылмады', 404, 'HISTORY_NOT_FOUND'); return NextResponse.json({ conversation }, { headers: { 'Cache-Control': 'no-store' } }); }
  catch (error) { return historyFailure(error); }
}
export async function DELETE(request: NextRequest, context: Context) {
  try { historyOrigin(request); const user = await requireAccountUser(); const id = await validId(context); if (!await deleteHistory(user.id, id)) throw new AccountError('Диалог не найден / Диалог табылмады', 404, 'HISTORY_NOT_FOUND'); return NextResponse.json({ deleted: true }, { headers: { 'Cache-Control': 'no-store' } }); }
  catch (error) { return historyFailure(error); }
}
