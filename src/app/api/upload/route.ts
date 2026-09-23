import { NextResponse } from 'next/server';
import type { Attachment } from '@/lib/types';
export const runtime='nodejs';
export const maxDuration=60;
const MAX=3*1024*1024;
export async function POST(request:Request){
 if(Number(request.headers.get('content-length')||0)>MAX+65536)return NextResponse.json({error:'Общий размер файлов — до 3 МБ / Файлдардың жалпы көлемі 3 МБ-тан аспауы керек'},{status:413});
 try{const form=await request.formData();const files=[...form.values()].filter((x):x is File=>x instanceof File);if(!files.length||files.length>3)return NextResponse.json({error:'Прикрепите от 1 до 3 файлов / 1–3 файл тіркеңіз'},{status:400});if(files.some(f=>f.size>MAX)||files.reduce((n,f)=>n+f.size,0)>MAX)return NextResponse.json({error:'Общий размер файлов — до 3 МБ / Жалпы көлемі 3 МБ-қа дейін'},{status:413});const attachments:Attachment[]=[];
 for(const f of files){const name=f.name.replace(/[\u0000-\u001f]/g,'').slice(0,180);const ext=name.split('.').at(-1)?.toLowerCase();const buffer=Buffer.from(await f.arrayBuffer());if(!buffer.length)return NextResponse.json({error:`Пустой файл: ${name}`},{status:400});let text='';
 if(['png','jpg','jpeg','webp'].includes(ext||'')){const png=buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));const jpg=buffer[0]===255&&buffer[1]===216&&buffer[2]===255;const webp=buffer.subarray(0,4).toString()==='RIFF'&&buffer.subarray(8,12).toString()==='WEBP';if(!png&&!jpg&&!webp)return NextResponse.json({error:`Некорректное изображение: ${name}`},{status:400});const type=png?'image/png':jpg?'image/jpeg':'image/webp';attachments.push({name,type,dataUrl:`data:${type};base64,${buffer.toString('base64')}`});continue;}
 if(ext==='pdf'){if(buffer.subarray(0,5).toString()!=='%PDF-')return NextResponse.json({error:`Некорректный PDF: ${name}`},{status:400});const {CanvasFactory,getData}=await import('pdf-parse/worker');const {PDFParse}=await import('pdf-parse');PDFParse.setWorker(getData());const parser=new PDFParse({data:buffer,CanvasFactory});try{const info=await parser.getInfo();const pages=Array.from({length:Math.min(info.total,20)},(_,i)=>i+1);text=(await parser.getText({partial:pages})).text;if(info.total>20)text+='\n[Прочитаны первые 20 страниц]';}finally{await parser.destroy();}}
 else if(ext==='docx'){const mammoth=await import('mammoth');text=(await mammoth.extractRawText({buffer})).value;}
 else if(ext==='xlsx'){const ExcelJS=await import('exceljs');const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(buffer as never);const rows:string[]=[];for(const sheet of workbook.worksheets.slice(0,8)){rows.push(`[${sheet.name}]`);sheet.eachRow((row,n)=>{if(n<=400)rows.push(row.values instanceof Array?row.values.slice(1,25).map(v=>typeof v==='object'?JSON.stringify(v):String(v??'')).join('\t'):'');});}text=rows.join('\n');}
 else if(['txt','csv'].includes(ext||''))text=buffer.toString('utf8');else return NextResponse.json({error:'Поддерживаются PDF, DOCX, XLSX, CSV, TXT, JPG, PNG, WEBP / Осы пішімдерге қолдау бар'},{status:415});
 if(!text.trim())return NextResponse.json({error:`Не найден читаемый текст в ${name}. Для скана загрузите страницу как JPG/PNG. / Мәтін табылмады, сканды JPG/PNG ретінде жүктеңіз.`},{status:422});attachments.push({name,type:f.type||'text/plain',text:text.slice(0,30000)});
 }
 return NextResponse.json({attachments});}catch{return NextResponse.json({error:'Не удалось прочитать файл. Проверьте, что он не поврежден и не защищен паролем. / Файлды оқу мүмкін болмады. Құпиясөзбен қорғалмағанын тексеріңіз.'},{status:422});}
}
