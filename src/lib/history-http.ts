import { NextRequest, NextResponse } from 'next/server';
import { AccountError } from './auth-server';

export function historyOrigin(request: NextRequest) {
  const origin = request.headers.get('origin');
  if ((origin && origin !== request.nextUrl.origin) || request.headers.get('sec-fetch-site') === 'cross-site') throw new AccountError('Недопустимый источник запроса / Сұрау көзі жарамсыз', 403, 'INVALID_ORIGIN');
}
export function historyFailure(error: unknown) {
  if (error instanceof AccountError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status, headers: { 'Cache-Control': 'no-store' } });
  console.error('History request failed:', error instanceof Error ? error.name : 'Unknown');
  return NextResponse.json({ error: 'Не удалось открыть историю. Повторите / Тарихты ашу мүмкін болмады. Қайталаңыз', code: 'HISTORY_UNAVAILABLE' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
}
