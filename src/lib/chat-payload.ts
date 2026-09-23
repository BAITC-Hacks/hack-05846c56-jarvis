import type { Attachment, ChatMessage, Locale } from './types';

// Leave room below the API's 4.4 MB and Vercel's 4.5 MB request limits.
export const CHAT_BODY_BYTE_LIMIT = 4_300_000;
export interface ChatPayload {
  locale: Locale;
  messages: readonly ChatMessage[];
  attachments?: readonly Attachment[];
  contextProductIds?: readonly string[];
}

/** Drop only oldest history messages. Never truncate the current request or files. */
export function buildChatBody(payload: ChatPayload): string {
  const ru = payload.locale === 'ru';
  if (!payload.messages.length) throw new Error(ru ? 'Введите сообщение.' : 'Хабарлама енгізіңіз.');
  const newest = payload.messages.at(-1)!;
  if (newest.content.length > 12000) throw new Error(ru
    ? 'Сообщение слишком длинное. Сократите его до 12 000 символов.'
    : 'Хабарлама тым ұзын. Оны 12 000 таңбаға дейін қысқартыңыз.');

  const encoder = new TextEncoder();
  // Serialize the large base64 payload once, and count JSON escape sequences too.
  const envelope = JSON.stringify({ locale: payload.locale, attachments: payload.attachments, contextProductIds: payload.contextProductIds });
  const prefix = envelope.slice(0, -1) + ',"messages":[';
  const suffix = ']}';
  const messages = payload.messages.slice(-24).map(message => JSON.stringify(message));
  const lengths = messages.map(message => encoder.encode(message).byteLength);
  let bytes = encoder.encode(prefix).byteLength + suffix.length + lengths.reduce((sum, length) => sum + length, 0) + messages.length - 1;
  let start = 0;
  while (bytes > CHAT_BODY_BYTE_LIMIT && start < messages.length - 1) {
    bytes -= lengths[start] + 1; // Removed message and its following comma.
    start++;
  }
  if (bytes > CHAT_BODY_BYTE_LIMIT) throw new Error(ru
    ? 'Сообщение и вложения слишком большие для отправки. Выберите файлы меньшего размера или отправьте их отдельными сообщениями.'
    : 'Хабарлама мен тіркемелерді бірге жіберу үшін көлемі тым үлкен. Көлемі кішірек файлдарды таңдаңыз немесе оларды бөлек хабарламалармен жіберіңіз.');
  return prefix + messages.slice(start).join(',') + suffix;
}
