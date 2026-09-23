import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildChatBody, CHAT_BODY_BYTE_LIMIT, type ChatPayload } from '../src/lib/chat-payload';

test('UTF-8 budget removes oldest Unicode history and retains a full 3 MiB image and latest request', () => {
  const image = { name:'Фото.jpg', type:'image/jpeg', dataUrl:'data:image/jpeg;base64,' + 'A'.repeat(4 * 1024 * 1024) };
  const messages = Array.from({length:24}, (_, index) => ({ role:index % 2 ? 'user' as const : 'assistant' as const, content:`${index}:` + 'Қазақша🙂\\"'.repeat(900), productIds:['515291'] }));
  const input: ChatPayload = { locale:'kk', messages, attachments:[image], contextProductIds:['515291'] };
  const original = JSON.stringify(input);
  const output = buildChatBody(input);
  const decoded = JSON.parse(output);
  assert.ok(Buffer.byteLength(output,'utf8') <= CHAT_BODY_BYTE_LIMIT);
  assert.ok(decoded.messages.length > 1 && decoded.messages.length < messages.length);
  assert.deepEqual(decoded.messages, messages.slice(-decoded.messages.length));
  assert.deepEqual(decoded.messages.at(-1), messages.at(-1));
  assert.deepEqual(decoded.attachments,[image]);
  assert.deepEqual(decoded.contextProductIds,['515291']);
  assert.equal(JSON.stringify(input),original,'input must remain unchanged');
});

test('documents are not truncated again; exact byte boundary is accepted and overflow fails in RU/KK', () => {
  const base: ChatPayload = {locale:'ru',messages:[{role:'user',content:'Проверьте файлы'}],attachments:[{name:'spec.txt',type:'text/plain',text:''}]};
  const overhead = Buffer.byteLength(buildChatBody(base));
  const attachment = {...base.attachments![0],text:'x'.repeat(CHAT_BODY_BYTE_LIMIT-overhead)};
  const exact = buildChatBody({...base,attachments:[attachment]});
  assert.equal(Buffer.byteLength(exact),CHAT_BODY_BYTE_LIMIT);
  assert.equal(JSON.parse(exact).attachments[0].text,attachment.text);
  assert.throws(()=>buildChatBody({...base,attachments:[{...attachment,text:attachment.text+'x'}]}),/файлы меньшего размера/);
  assert.throws(()=>buildChatBody({...base,locale:'kk',attachments:[{...attachment,text:attachment.text+'x'}]}),/кішірек файлдарды/);
});

test('API count boundary preserves newest 24 messages and rejects an oversized newest request without truncation', () => {
  const messages=Array.from({length:30},(_,index)=>({role:'user' as const,content:String(index)}));
  assert.deepEqual(JSON.parse(buildChatBody({locale:'ru',messages})).messages,messages.slice(-24));
  assert.throws(()=>buildChatBody({locale:'ru',messages:[{role:'user',content:'x'.repeat(12001)}]}),/12 000/);
});
