import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PAYMENT_REDACTION_TEXT as masked, redactPaymentDetails } from '../src/lib/payment-privacy';

// Public payment-network test numbers, never real customer details.
test('recognizable grouped Luhn PAN and labeled unformatted cards are masked', () => {
 for (const text of ['4111 1111 1111 1111','4111-1111-1111-1111','4111\u00a01111\u00a01111\u00a01111']) assert.equal(redactPaymentDetails(text),masked);
 for (const text of ['Карта: 4111111111111111','номер банковской карты = 4222222222222','Card number: 378282246310005','PAN 4111111111111111','Картаның нөмірі: 4111111111111111']) {
  assert.ok(redactPaymentDetails(text).includes(masked));assert.doesNotMatch(redactPaymentDetails(text),/4111111111111111|4222222222222|378282246310005/);
 }
 assert.equal(redactPaymentDetails('Карта 4111111111111111 2 шт'),'Карта '+masked+' 2 шт');
});

test('invalid checksum and unlabeled contiguous identifiers do not become assumed cards', () => {
 for (const text of ['4111 1111 1111 1112','Карта: 4111111111111112','0000 0000 0000 0000','Артикул 4111111111111111','SKU4111111111111111','CARD4111111111111111','4111111111111111_','PIN1234','CVC1234','CVV123']) assert.equal(redactPaymentDetails(text),text);
});

test('only labeled security codes are masked; nearby quantities and electrical data remain intact', () => {
 for (const text of ['CVV: 123','CVC2=1234','код безопасности: 123','қауіпсіздік коды 123','PIN 1234','ПИН-код: 123456']) assert.ok(redactPaymentDetails(text).includes(masked));
 const product='Артикулы 200300285_ / 515291 / 19281; 160А / 250А; 2 шт; цена 64920 ₸; 230В; код товара: 1234; CVV не указан';
 assert.equal(redactPaymentDetails(product),product);
 assert.equal(redactPaymentDetails('PIN 12; CVC 19281'),'PIN 12; CVC 19281');
});

test('Kazakhstan IBAN is redacted with spacing and is not confused with a short SKU', () => {
 for (const text of ['KZ86125KZT5004100100','KZ86 125K ZT50 0410 0100','kz86125kzt5004100100']) assert.equal(redactPaymentDetails(text),masked);
 for (const text of ['KZ86125','SKU_KZ86125KZT5004100100','KZ86125KZT50041001001']) assert.equal(redactPaymentDetails(text),text);
});

test('redaction is idempotent and leaves non-payment multilingual prose unchanged', () => {
 const text='Карта 4111111111111111, CVC: 123, IBAN KZ86125KZT5004100100. 19281 2 дана';
 assert.equal(redactPaymentDetails(redactPaymentDetails(text)),redactPaymentDetails(text));
 const clean='Маған 16А автомат керек. Бюджет: бірлік үшін 5000 теңгеге дейін';
 assert.equal(redactPaymentDetails(clean),clean);
});
