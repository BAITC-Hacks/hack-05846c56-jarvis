import 'server-only';
import { randomUUID } from 'node:crypto';
import { neon, type NeonQueryFunction } from '@neondatabase/serverless';
import { AccountError } from './auth-server';
import { getProduct } from './catalog';
import { historyMessageSchema, storedHistoryMessages, type HistoryConversation, type HistoryMessage, type HistorySummary, type SaveHistoryInput } from './history-types';
import { redactPaymentDetails } from './payment-privacy';

let client: NeonQueryFunction<false, false> | undefined;
let migration: Promise<void> | undefined;
function database() {
  if (!client) {
    const connection = process.env.DATABASE_URL;
    if (!connection) throw new AccountError('История пока недоступна / Тарих әзірге қолжетімсіз');
    client = neon(connection);
  }
  return client;
}
export async function ensureHistorySchema() {
  if (!migration) migration = (async () => {
    const sql = database();
    await sql`CREATE TABLE IF NOT EXISTS jarvis_conversations (
      id UUID PRIMARY KEY,
      user_id TEXT NOT NULL,
      title VARCHAR(160) NOT NULL,
      locale VARCHAR(2) NOT NULL CHECK (locale IN ('ru','kk')),
      messages JSONB NOT NULL CHECK (jsonb_typeof(messages) = 'array'),
      revision INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`;
    await sql`CREATE INDEX IF NOT EXISTS jarvis_conversations_owner_updated ON jarvis_conversations (user_id, updated_at DESC)`;
  })().catch(error => { migration = undefined; throw error; });
  await migration;
}
type Row = { id: string; title: string; locale: 'ru'|'kk'; revision: number; created_at: string | Date; updated_at: string | Date; message_count: number; messages?: unknown };
const summary = (row: Row): HistorySummary => ({ id: row.id, title: row.title, locale: row.locale, revision: Number(row.revision), createdAt: new Date(row.created_at).toISOString(), updatedAt: new Date(row.updated_at).toISOString(), messageCount: Number(row.message_count) });

export async function listHistory(userId: string): Promise<HistorySummary[]> {
  await ensureHistorySchema(); const sql = database();
  const rows = await sql`SELECT id, title, locale, revision, created_at, updated_at, jsonb_array_length(messages) AS message_count FROM jarvis_conversations WHERE user_id = ${userId} ORDER BY updated_at DESC LIMIT 100`;
  return (rows as Row[]).map(summary);
}
export async function saveHistory(userId: string, input: SaveHistoryInput): Promise<HistorySummary> {
  await ensureHistorySchema(); const sql = database();
  const messages = storedHistoryMessages(input.messages);
  const title = redactPaymentDetails(input.title || messages.find(message => message.role === 'user')?.content.trim() || 'Диалог').slice(0,input.title ? 160 : 100);
  const body = JSON.stringify(messages);
  if (Buffer.byteLength(body, 'utf8') > 400000) throw new AccountError('Диалог слишком большой / Диалог тым үлкен', 413, 'HISTORY_TOO_LARGE');
  if (input.id) {
    const rows = await sql`UPDATE jarvis_conversations SET title = ${title}, locale = ${input.locale}, messages = ${body}::jsonb, revision = revision + 1, updated_at = NOW() WHERE id = ${input.id}::uuid AND user_id = ${userId} AND revision = ${input.revision} RETURNING id, title, locale, revision, created_at, updated_at, jsonb_array_length(messages) AS message_count`;
    if (!rows.length) {
      const owned = await sql`SELECT id FROM jarvis_conversations WHERE id = ${input.id}::uuid AND user_id = ${userId}`;
      if (!owned.length) throw new AccountError('Диалог не найден / Диалог табылмады', 404, 'HISTORY_NOT_FOUND');
      throw new AccountError('Диалог изменён в другой вкладке. Откройте его из истории / Диалог басқа қойындыда өзгертілген. Оны тарихтан ашыңыз', 409, 'HISTORY_CONFLICT');
    }
    return summary(rows[0] as Row);
  }
  const id = randomUUID();
  const rows = await sql`INSERT INTO jarvis_conversations (id, user_id, title, locale, messages) SELECT ${id}::uuid, ${userId}, ${title}, ${input.locale}, ${body}::jsonb WHERE (SELECT COUNT(*) FROM jarvis_conversations WHERE user_id = ${userId}) < 100 RETURNING id, title, locale, revision, created_at, updated_at, jsonb_array_length(messages) AS message_count`;
  if (!rows.length) throw new AccountError('Сохранено 100 диалогов. Удалите ненужный, чтобы сохранить новый / 100 диалог сақталды. Жаңасын сақтау үшін қажетсізін жойыңыз', 409, 'HISTORY_LIMIT');
  return summary(rows[0] as Row);
}
export async function readHistory(userId: string, id: string): Promise<HistoryConversation | null> {
  await ensureHistorySchema(); const sql = database();
  const rows = await sql`SELECT id, title, locale, revision, created_at, updated_at, messages, jsonb_array_length(messages) AS message_count FROM jarvis_conversations WHERE id = ${id}::uuid AND user_id = ${userId}`;
  if (!rows.length) return null;
  const row = rows[0] as Row;
  const rawMessages = Array.isArray(row.messages) ? row.messages : [];
  const messages = rawMessages.slice(-100).flatMap(raw => { const parsed = historyMessageSchema.safeParse(raw); return parsed.success ? [parsed.data] : []; });
  const ids = [...new Set(messages.flatMap(message => message.productIds || []))].slice(-40);
  const products = await Promise.all(ids.map(async productId => { try { return await getProduct(productId); } catch { return null; } }));
  const found = new Map(products.filter(product => !!product).map(product => [product!.id, product!]));
  const hydrated: HistoryMessage[] = messages.map(message => ({ ...message, products: (message.productIds || []).flatMap(productId => found.has(productId) ? [found.get(productId)!] : []) }));
  return { ...summary(row), messages: hydrated };
}
export async function deleteHistory(userId: string, id: string): Promise<boolean> {
  await ensureHistorySchema(); const sql = database();
  const rows = await sql`DELETE FROM jarvis_conversations WHERE id = ${id}::uuid AND user_id = ${userId} RETURNING id`;
  return rows.length > 0;
}
