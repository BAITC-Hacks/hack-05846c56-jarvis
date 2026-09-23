import { NextResponse } from 'next/server';
import { z } from 'zod';
import { answerAssistant } from '@/lib/assistant';
import { redactPaymentDetails } from '@/lib/payment-privacy';
export const runtime='nodejs';
export const maxDuration=60;
const schema=z.object({locale:z.enum(['ru','kk']).default('ru'),messages:z.array(z.object({role:z.enum(['user','assistant']),content:z.string().max(12000),productIds:z.array(z.string().regex(/^\d{1,12}$/)).max(12).optional()})).min(1).max(24),attachments:z.array(z.object({name:z.string().max(200),type:z.string().max(150),text:z.string().max(30000).optional(),warning:z.string().max(500).optional(),truncated:z.boolean().optional(),dataUrl:z.string().max(4200000).regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/).optional()})).max(3).optional(),contextProductIds:z.array(z.string().regex(/^\d{1,12}$/)).max(12).optional()});
const rate=new Map<string,{count:number;until:number}>();
export async function POST(request:Request){
 const size=Number(request.headers.get('content-length')||0);if(size>4400000)return NextResponse.json({error:'Слишком большой запрос / Сұрау тым үлкен'},{status:413});
 const ip=(request.headers.get('x-forwarded-for')||'local').split(',')[0];const now=Date.now();if(rate.size>5000)for(const [k,v] of rate)if(v.until<now)rate.delete(k);let bucket=rate.get(ip);if(!bucket||bucket.until<now){bucket={count:0,until:now+60000};rate.set(ip,bucket);}if(++bucket.count>15)return NextResponse.json({error:'Слишком много сообщений. Попробуйте через минуту. / Бір минуттан кейін қайталаңыз.'},{status:429});
 try{const raw=await request.text();if(raw.length>4400000)return NextResponse.json({error:'Слишком большой запрос'},{status:413});const parsed=schema.safeParse(JSON.parse(raw));if(!parsed.success)return NextResponse.json({error:'Проверьте формат сообщения / Хабарлама пішімін тексеріңіз'},{status:400});const input={...parsed.data,messages:parsed.data.messages.map(message=>({...message,content:redactPaymentDetails(message.content)})),attachments:parsed.data.attachments?.map(attachment=>({...attachment,name:redactPaymentDetails(attachment.name),text:attachment.text==null?undefined:redactPaymentDetails(attachment.text),warning:attachment.warning==null?undefined:redactPaymentDetails(attachment.warning)}))};return NextResponse.json(await answerAssistant(input));}catch{return NextResponse.json({error:'Не удалось обработать запрос. Попробуйте ещё раз. / Сұрауды өңдеу мүмкін болмады. Қайталап көріңіз.'},{status:500});}
}
