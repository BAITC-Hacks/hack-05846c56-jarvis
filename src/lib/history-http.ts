import { NextRequest, NextResponse } from 'next/server';
import { AccountError } from './auth-server';
import { AuthPolicyError, protectAuthOrigin } from './auth-policy';

export function historyOrigin(request: NextRequest) {
  try { protectAuthOrigin(request); }
  catch (error) {
    if (error instanceof AuthPolicyError) throw new AccountError(error.message, error.status, error.code);
    throw error;
  }
}
export function historyFailure(error: unknown) {
  if (error instanceof AccountError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status, headers: { 'Cache-Control': 'no-store' } });
  console.error('History request failed:', error instanceof Error ? error.name : 'Unknown');
  return NextResponse.json({ error: 'Не удалось открыть историю. Повторите / Тарихты ашу мүмкін болмады. Қайталаңыз', code: 'HISTORY_UNAVAILABLE' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
}
