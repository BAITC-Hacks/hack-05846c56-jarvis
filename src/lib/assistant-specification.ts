import type { Attachment, Locale, Product, SpecificationRow } from './types';

export interface StructuredSpecificationLine { label: string; query: string; quantity: number | null; }

/** Only bypass AI when every nonempty attachment is an explicit SKU/quantity table.
 * Unknown prose, mixed documents and ambiguous layouts keep the normal review path. */
export function extractStructuredSpecification(attachments: Attachment[]): StructuredSpecificationLine[] | null {
 if (!attachments.length || attachments.some(attachment => attachment.dataUrl || !attachment.text?.trim())) return null;
 const rows: StructuredSpecificationLine[] = [];
 for (const attachment of attachments) {
  let columns: { delimiter: string; code: number; quantity: number } | null = null;
  let recognized = false;
  for (const rawLine of attachment.text!.replace(/^\uFEFF/, '').split(/\r?\n/)) {
   const line = rawLine.trim();
   if (!line) continue;
   if (/^\[.*\]$/.test(line)) { columns = null; continue; }
   const delimiter = line.includes('\t') ? '\t' : line.includes(';') ? ';' : line.includes(',') ? ',' : null;
   if (delimiter) {
    const cells = splitCells(line, delimiter);
    const code = cells.findIndex(cell => /^(?:артикул|код(?:\s+товара)?|sku|article|тауар\s+коды)$/i.test(cell));
    const quantity = cells.findIndex(cell => /^(?:кол(?:ичество|[.-]?во)|quantity|qty|сан[ыа]?|саны|кол-во)(?:\s*[,([][^\r\n]*)?$/i.test(cell));
    if (code >= 0 && quantity >= 0 && code !== quantity) { columns = { delimiter, code, quantity }; recognized = true; continue; }
   }
   if (!columns) return null;
   const cells = splitCells(line, columns.delimiter);
   if (/^(?:итого|всего|total|барлығы)(?:\s|$)/i.test(cells[0] || '')) continue;
   const code = cells[columns.code] || '';
   // No fuzzy interpretation of prose, several articles in one cell, or formulas.
   if (!/^[\p{L}\p{N}._/-]{1,80}$/u.test(code) || !/\d/.test(code)) return null;
   const rawQuantity = cells[columns.quantity] || '';
   const quantity = /^\d+(?:[.,]\d+)?$/.test(rawQuantity) ? Number(rawQuantity.replace(',', '.')) : NaN;
   rows.push({ label: code, query: code, quantity: Number.isFinite(quantity) && quantity > 0 && quantity <= 100000 ? quantity : null });
  }
  if (!recognized) return null;
 }
 return rows.length ? rows : null;
}

export async function resolveStructuredSpecification(
 lines: StructuredSpecificationLine[],
 lookup: (query: string, options: { limit: number; maxPrice?: number }) => Promise<Product[]>,
 maxPrice?: number,
): Promise<SpecificationRow[]> {
 return Promise.all(lines.slice(0, 12).map(async line => {
  const query = line.query.trim().toLowerCase();
  const candidates = await lookup(line.query, { limit: 12, maxPrice });
  // A product-name prefix or fuzzy SKU hit must never preselect a different item.
  const matches = [...new Map(candidates.filter(product =>
   [product.id, product.sku, product.specs.ARTIKULPOSTAVSHCHIKA].some(value => value?.trim().toLowerCase() === query)
   && (maxPrice == null || (product.price != null && product.price <= maxPrice))
  ).map(product => [product.id, product])).values()];
  return { label: line.label, quantity: line.quantity, products: matches, exact: matches.length === 1 };
 }));
}

// Only count rows with an explicit SKU/code column and an explicit numeric quantity column.
// Prose lines, headings and numbered instructions are not assumed to be procurement items.
export function countStructuredSpecificationRows(attachments: Attachment[]): number | null {
 let count = 0;
 let recognized = false;
 for (const attachment of attachments) {
  let columns: { delimiter: string; code: number; quantity: number } | null = null;
  for (const line of (attachment.text || '').split(/\r?\n/)) {
   if (/^\[.*\]$/.test(line.trim())) { columns = null; continue; }
   const delimiter = line.includes('\t') ? '\t' : line.includes(';') ? ';' : line.includes(',') ? ',' : null;
   if (delimiter) {
    const cells = splitCells(line, delimiter);
    const code = cells.findIndex(cell => /^(?:артикул|код(?:\s+товара)?|sku|article|тауар\s+коды)$/i.test(cell));
    const quantity = cells.findIndex(cell => /^(?:кол(?:ичество|[.-]?во)|quantity|qty|сан[ыа]?|саны|кол-во)(?:\s*[,([][^\r\n]*)?$/i.test(cell));
    if (code >= 0 && quantity >= 0) { columns = { delimiter, code, quantity }; recognized = true; continue; }
   }
   if (!columns) continue;
   const cells = splitCells(line, columns.delimiter);
   const code = cells[columns.code] || '';
   if (code.length <= 80 && !/\s/.test(code) && /\d/.test(code) && /^\d+(?:[.,]\d+)?$/.test(cells[columns.quantity]?.trim() || '') && Number(cells[columns.quantity].replace(',', '.')) > 0) count++;
  }
 }
 return recognized ? count : null;
}
function splitCells(line: string, delimiter: string): string[] {
 const cells: string[] = []; let current = ''; let quoted = false;
 for (let i = 0; i < line.length; i++) {
  const char = line[i];
  if (char === '"') { if (quoted && line[i + 1] === '"') { current += '"'; i++; } else quoted = !quoted; }
  else if (char === delimiter && !quoted) { cells.push(current.trim()); current = ''; }
  else current += char;
 }
 cells.push(current.trim()); return cells;
}

export function specificationLimitWarning(attachments: Attachment[], returnedRows: number, hasMoreLines: boolean | null | undefined, locale: Locale): string | null {
 const kk = locale === 'kk';
 const counted = countStructuredSpecificationRows(attachments);
 const truncated = attachments.some(attachment => attachment.truncated || (attachment.text?.length || 0) > 16000);
 if (counted != null && counted > returnedRows) return kk
  ? `⚠ Құжатта кемінде ${counted} тауар жолы анықталды, жауапта тек ${returnedRows} жол өңделді. Қалған жолдар өңделген жоқ. Оларды бөлек файлмен жіберіңіз; бір ретте ең көбі 12 позиция өңделеді.`
  : `⚠ В документе обнаружено не менее ${counted} товарных строк, в ответе обработано только ${returnedRows}. Остальные строки не обработаны. Отправьте их отдельным файлом; за один раз обрабатываются максимум 12 позиций.`;
 if (hasMoreLines === true) return kk
  ? `⚠ Тек алғашқы ${returnedRows} позиция өңделді. Құжатта тағы тауарлар бар; қалған жолдар өңделген жоқ. Оларды бөлек файлмен жіберіңіз (әр бөлік 12 позицияға дейін).`
  : `⚠ Обработаны только первые ${returnedRows} позиций. В документе есть дополнительные товары; остальные строки не обработаны. Отправьте их отдельным файлом (до 12 позиций в каждой части).`;
 if (truncated) return kk
  ? `⚠ Құжат мәтінінің бір бөлігі қысқартылған. Тек ${returnedRows} көрінетін позиция өңделді; толық құжат өңделгені расталмайды. Қалған бөлігін бөлек жүктеңіз.`
  : `⚠ Часть текста документа была обрезана. Обработано ${returnedRows} видимых позиций; полнота обработки не подтверждена. Загрузите оставшуюся часть отдельно.`;
 if (hasMoreLines == null || (returnedRows >= 12 && counted == null)) return kk
  ? `⚠ ${returnedRows} позиция өңделді. Құжаттағы тауарлардың жалпы санын сенімді анықтау мүмкін болмады. Бастапқы файлмен салыстырып, көрсетілмеген жолдарды бөлек жіберіңіз; шек — 12 позиция.`
  : `⚠ Обработано ${returnedRows} позиций. Общее число товарных строк в документе не удалось надёжно подтвердить. Сверьте с исходным файлом и отдельно отправьте непоказанные строки; лимит — 12 позиций.`;
 return null;
}
