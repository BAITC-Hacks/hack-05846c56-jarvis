/** Conservative text-only redaction, shared by browser and server.
 * This does not inspect image pixels, original file bytes, or all personal data.
 */
export const PAYMENT_REDACTION_TEXT = '[скрыто / жасырылды]';

function validCardNumber(value: string): boolean {
 const digits = value.replace(/\D/g, '');
 if (!/^\d{13,19}$/.test(digits) || /^(\d)\1+$/.test(digits)) return false;
 let sum = 0;
 for (let index = digits.length - 1, double = false; index >= 0; index--, double = !double) {
  let digit = Number(digits[index]);
  if (double) { digit *= 2; if (digit > 9) digit -= 9; }
  sum += digit;
 }
 return sum % 10 === 0;
}

export function redactPaymentDetails(text: string): string {
 let output = text;
 // Kazakhstan IBAN: country/check digits + three bank digits + thirteen account characters.
 output = output.replace(/(?<![\p{L}\p{N}_])KZ[ \t\u00a0\u202f-]*\d[ \t\u00a0\u202f-]*\d(?:[ \t\u00a0\u202f-]*\d){3}(?:[ \t\u00a0\u202f-]*[A-Z0-9]){13}(?![\p{L}\p{N}_])/giu, PAYMENT_REDACTION_TEXT);
 // Only explicit security-code labels; standalone counts, ratings and articles stay intact.
 output = output.replace(/(?<![\p{L}\p{N}_])((?:CVV2?|CVC2?|CID|код\s+безопасности|қауіпсіздік\s+коды)(?:\s*[:=№#-]\s*|\s+))\d{3,4}(?![\p{L}\p{N}_])/giu, '$1' + PAYMENT_REDACTION_TEXT);
 output = output.replace(/(?<![\p{L}\p{N}_])((?:PIN(?:[ -]?(?:код|code))?|ПИН(?:[ -]?код)?)(?:\s*[:=№#-]\s*|\s+))\d{4,6}(?![\p{L}\p{N}_])/giu, '$1' + PAYMENT_REDACTION_TEXT);
 // Four groups of four are recognizable without a label, but must pass Luhn.
 output = output.replace(/(?<![\p{L}\p{N}_])\d{4}(?:[ \t\u00a0\u202f-]+\d{4}){3}(?![\p{L}\p{N}_])/gu, value => validCardNumber(value) ? PAYMENT_REDACTION_TEXT : value);
 // Unformatted/other-length PANs require a payment label. Never mask a generic numeric SKU.
 output = output.replace(/(?<![\p{L}\p{N}_])((?:номер\s+(?:банковской\s+)?карты|банковская\s+карта|карта(?:ның\s+нөмірі)?|картаның|төлем\s+картасы|card(?:\s+(?:number|no\.?))?|PAN)(?:\s*[:=№#-]\s*|\s+))(\d(?:[\d \t\u00a0\u202f-]{11,45})\d)(?![\p{L}\p{N}_])/giu, (whole, label: string, value: string) => {
  // Prefer complete numeric groups: do not accidentally append a following quantity to a PAN.
  const groups = [...value.matchAll(/\d+/g)];
  let digits = '';
  for (const group of groups) {
   digits += group[0];
   if (digits.length > 19) break;
   if (validCardNumber(digits)) {
    const end = group.index! + group[0].length;
    return label + PAYMENT_REDACTION_TEXT + value.slice(end);
   }
  }
  return whole;
 });
 return output;
}
