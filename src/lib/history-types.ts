import { z } from 'zod';
import type { Locale, Product } from './types';

export interface HistoryMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  productIds?: string[];
  products?: Product[];
  attachments?: string[];
  sources?: { title: string; url: string }[];
  suggestions?: string[];
  cartUrl?: '/cart';
}
export interface HistorySummary { id: string; title: string; locale: Locale; revision: number; createdAt: string; updatedAt: string; messageCount: number }
export interface HistoryConversation extends HistorySummary { messages: HistoryMessage[] }
export interface AccountUser { id: string; email: string; name: string }

const safeSource = z.string().url().max(2000).refine(value => {
  try { return ['https:', 'http:'].includes(new URL(value).protocol); } catch { return false; }
});
export const historyMessageSchema = z.object({
  id: z.string().min(1).max(100),
  role: z.enum(['user', 'assistant']),
  content: z.string().max(20000),
  productIds: z.array(z.string().regex(/^\d{1,12}$/)).max(24).optional(),
  attachments: z.array(z.string().max(180)).max(3).optional(),
  sources: z.array(z.object({ title: z.string().max(180), url: safeSource })).max(16).optional(),
  suggestions: z.array(z.string().max(500)).max(8).optional(),
  cartUrl: z.literal('/cart').optional(),
});
export const saveHistorySchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(160).optional(),
  locale: z.enum(['ru', 'kk']),
  revision: z.number().int().positive().optional(),
  messages: z.array(historyMessageSchema).min(1).max(100),
}).refine(value => !value.id || !!value.revision, { message: 'Revision required when updating an existing conversation' });
export type SaveHistoryInput = z.infer<typeof saveHistorySchema>;

/** Persist historical text, filenames and catalog IDs; never full product objects or file blobs. Prices inside the historical text remain unchanged. */
export function storedHistoryMessages(messages: HistoryMessage[]): z.infer<typeof historyMessageSchema>[] {
  return messages.slice(-100).map(message => historyMessageSchema.parse({
    id: message.id, role: message.role, content: message.content,
    productIds: [...new Set([...(message.productIds || []), ...(message.products || []).map(product => product.id)])].slice(0, 24),
    attachments: message.attachments?.slice(0, 3), sources: message.sources?.slice(0, 16), suggestions: message.suggestions?.slice(0, 8), cartUrl: message.cartUrl,
  }));
}
