import {test} from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {answerAssistant} from '../src/lib/assistant';
import {hasUnusableImage} from '../src/lib/assistant-image';
const attachment=(buffer:Buffer,name='photo.png')=>({name,type:'image/png',dataUrl:`data:image/png;base64,${buffer.toString('base64')}`});

test('flat grey direct chat image cannot produce a model claim in RU or KK',async()=>{
 const flat=await sharp({create:{width:320,height:240,channels:3,background:'#aaaaaa'}}).png().toBuffer();
 const key=process.env.OPENAI_API_KEY;const originalFetch=globalThis.fetch;let requests=0;process.env.OPENAI_API_KEY='test-key-no-network';globalThis.fetch=async()=>{requests++;throw Error('No external call permitted for blank image');};
 try{for(const locale of ['ru','kk'] as const){const response=await answerAssistant({locale,messages:[{role:'user',content:'Определи оборудование на этом фото и добавь 2 шт'}],attachments:[attachment(flat)]});assert.equal(response.mode,'catalog');assert.deepEqual(response.products,[]);assert.equal(response.proposedItems,undefined);assert.match(response.message,locale==='ru'?/недостаточно различимых деталей/:/жеткілікті айқын бөлшектер/);assert.doesNotMatch(response.message,/ABB|Legrand|Schneider|автоматический выключатель|3 полюс/i);}}
 finally{globalThis.fetch=originalFetch;if(key)process.env.OPENAI_API_KEY=key;else delete process.env.OPENAI_API_KEY;}assert.equal(requests,0);
});
test('unreadable and invalid direct data URLs are rejected before planner',async()=>{
 for(const dataUrl of ['data:image/jpeg;base64,AA==','data:image/png;base64,','data:image/png;base64,invalid$$','https://example.com/image.png'])assert.equal(await hasUnusableImage([{name:'broken',type:'image/png',dataUrl}]),true);
});
test('information gate checks every image and allows high contrast detail',async()=>{
 const pixels=Buffer.alloc(64*64*3);for(let y=0;y<64;y++)for(let x=0;x<64;x++)for(let channel=0;channel<3;channel++)pixels[(y*64+x)*3+channel]=(x+y)%2?255:0;
 const detailed=await sharp(pixels,{raw:{width:64,height:64,channels:3}}).png().toBuffer();const blank=await sharp({create:{width:32,height:32,channels:3,background:'#ffffff'}}).png().toBuffer();
 assert.equal(await hasUnusableImage([attachment(detailed)]),false);assert.equal(await hasUnusableImage([attachment(detailed),attachment(blank)]),true);assert.equal(await hasUnusableImage([{name:'list.txt',type:'text/plain',text:'11054DEK'}]),false);
});
