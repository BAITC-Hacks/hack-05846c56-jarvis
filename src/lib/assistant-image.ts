import type { Attachment } from './types';
import { isLowInformationImage } from './attachment-parser';

/** Validate every submitted image before any model call, including direct /api/chat clients. */
export async function hasUnusableImage(attachments: Attachment[]): Promise<boolean> {
 for (const attachment of attachments) {
  if (!attachment.dataUrl) continue;
  const match = attachment.dataUrl.match(/^data:image\/(?:png|jpeg|webp);base64,([A-Za-z0-9+/]*={0,2})$/);
  if (!match || !match[1] || match[1].length > 4 * 1024 * 1024) return true;
  try {
   const buffer = Buffer.from(match[1], 'base64');
   if (!buffer.length || buffer.length > 3 * 1024 * 1024 || await isLowInformationImage(buffer)) return true;
  } catch { return true; }
 }
 return false;
}
