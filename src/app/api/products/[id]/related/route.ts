import { NextRequest, NextResponse } from 'next/server';
import { getRelatedProducts } from '@/lib/related';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const rawLimit = Number(request.nextUrl.searchParams.get('limit') || 3);
  const limit = Number.isFinite(rawLimit) ? Math.min(4, Math.max(1, Math.floor(rawLimit))) : 3;
  try {
    const response = await getRelatedProducts(id, limit);
    if (!response) return NextResponse.json({ error: 'Товар не найден / Тауар табылмады' }, { status: 404 });
    return NextResponse.json(response, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Не удалось проверить сопутствующие товары / Қосымша тауарларды тексеру мүмкін болмады' }, { status: 503 });
  }
}
