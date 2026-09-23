import { NextResponse } from 'next/server';
import { AttachmentError,parseAttachment,UPLOAD_BYTES } from '@/lib/attachment-parser';
export const runtime='nodejs';
export const maxDuration=60;
export async function POST(request:Request){
 if(Number(request.headers.get('content-length')||0)>UPLOAD_BYTES+65536)return NextResponse.json({error:'Общий размер файлов — до 3 МБ / Жалпы көлемі 3 МБ-қа дейін'},{status:413});
 try{const form=await request.formData(),files=[...form.values()].filter((value):value is File=>value instanceof File);if(!files.length||files.length>3)throw new AttachmentError('Прикрепите от 1 до 3 файлов / 1–3 файл тіркеңіз',400);if(files.reduce((n,f)=>n+f.size,0)>UPLOAD_BYTES)throw new AttachmentError('Общий размер файлов — до 3 МБ / Жалпы көлемі 3 МБ-қа дейін',413);const attachments=[];for(const file of files)attachments.push(await parseAttachment(file));return NextResponse.json({attachments});}
 catch(error){return NextResponse.json({error:error instanceof AttachmentError?error.message:'Не удалось прочитать файл. Проверьте, что он не поврежден и не защищен паролем / Файлды оқу мүмкін болмады. Файл зақымдалмағанын және құпиясөзбен қорғалмағанын тексеріңіз'},{status:error instanceof AttachmentError?error.status:422});}
}
