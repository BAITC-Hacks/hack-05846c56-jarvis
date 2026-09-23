import { inflateRawSync } from 'node:zlib';
import sharp, { type Stats } from 'sharp';
import type { Attachment } from './types';
export const UPLOAD_BYTES=3*1024*1024,TEXT_CHARACTERS=16000;
export class AttachmentError extends Error { constructor(message:string,public status=422){super(message);} }
// Conservative blank-frame guard, not a general image-recognition confidence score.
export function lowInformationStats(stats: Stats): boolean {
 return stats.entropy < 0.5 && Math.max(...stats.channels.map(channel => channel.stdev)) < 2;
}
export async function isLowInformationImage(buffer: Buffer): Promise<boolean> {
 const image = sharp(buffer, { limitInputPixels: 16000000, failOn: 'warning', animated: false });
 const meta = await image.metadata();
 if (!['png','jpeg','webp'].includes(meta.format || '') || !meta.width || !meta.height || meta.width * meta.height > 16000000 || (meta.pages || 1) > 1) throw new AttachmentError('Некорректное изображение / Сурет дұрыс емес');
 return lowInformationStats(await image.stats());
}
// Check actual ZIP expansion before either Office parser; reject encryption/ZIP64.
export function validateOfficeArchive(b:Buffer){
 const invalid=()=>{throw new AttachmentError('Поврежденный Office-файл / Office файлы зақымдалған');};let end=-1;
 for(let i=b.length-22;i>=Math.max(0,b.length-65557);i--)if(b.readUInt32LE(i)===0x06054b50){end=i;break;}
 if(end<0)return invalid();const count=b.readUInt16LE(end+10);if(!count||count>2000||b.readUInt16LE(end+4)||b.readUInt16LE(end+6))return invalid();let cursor=b.readUInt32LE(end+16),expanded=0;
 for(let i=0;i<count;i++){
  if(cursor+46>end||b.readUInt32LE(cursor)!==0x02014b50)return invalid();const flags=b.readUInt16LE(cursor+8),method=b.readUInt16LE(cursor+10),compressedSize=b.readUInt32LE(cursor+20),size=b.readUInt32LE(cursor+24),local=b.readUInt32LE(cursor+42);
  if(size>8*1024*1024||expanded+size>32*1024*1024)throw new AttachmentError('Office-файл слишком большой после распаковки / Ашылған Office файлы тым үлкен',413);
  if((flags&1)||![0,8].includes(method)||local+30>b.length||b.readUInt32LE(local)!==0x04034b50)return invalid();const start=local+30+b.readUInt16LE(local+26)+b.readUInt16LE(local+28);if(start+compressedSize>b.length)return invalid();const compressed=b.subarray(start,start+compressedSize),actual=method===0?compressed:inflateRawSync(compressed,{maxOutputLength:8*1024*1024});if(actual.length!==size)return invalid();expanded+=actual.length;cursor+=46+b.readUInt16LE(cursor+28)+b.readUInt16LE(cursor+30)+b.readUInt16LE(cursor+32);
 }
}
export async function parseAttachment(file:File):Promise<Attachment & {warning?:string;truncated?:boolean}>{
 const name=file.name.replace(/[\u0000-\u001f]/g,'').slice(0,180);if(file.size>UPLOAD_BYTES)throw new AttachmentError('Файл больше 3 МБ / Файл 3 МБ-тан үлкен',413);if(!file.size)throw new AttachmentError(`Пустой файл / Бос файл: ${name}`,400);
 const buffer=Buffer.from(await file.arrayBuffer()),ext=name.split('.').at(-1)?.toLowerCase(),warnings:string[]=[];let text='';
 if(['png','jpg','jpeg','webp'].includes(ext||'')){
  try{const image=sharp(buffer,{limitInputPixels:16000000,failOn:'warning',animated:false}),meta=await image.metadata();if(!['png','jpeg','webp'].includes(meta.format||'')||!meta.width||!meta.height||meta.width*meta.height>16000000||(meta.pages||1)>1)throw new Error('unsupported');const stats=await image.stats();if(lowInformationStats(stats))throw new AttachmentError('На фото не виден товар или маркировка. Сделайте более чёткое фото / Суретте тауар немесе таңбалау көрінбейді. Анығырақ сурет түсіріңіз');const type=`image/${meta.format}`;return{name,type,dataUrl:`data:${type};base64,${buffer.toString('base64')}`};}catch(error){if(error instanceof AttachmentError)throw error;throw new AttachmentError(`Изображение повреждено или превышает 16 мегапикселей; анимация не поддерживается / Сурет зақымдалған немесе 16 мегапиксельден асады: ${name}`);}
 }
 if(ext==='pdf'){
  if(buffer.subarray(0,5).toString()!=='%PDF-')throw new AttachmentError('Некорректный PDF / PDF дұрыс емес',400);const {CanvasFactory,getData}=await import('pdf-parse/worker');const {PDFParse}=await import('pdf-parse');PDFParse.setWorker(getData());const parser=new PDFParse({data:buffer,CanvasFactory});
  try{const info=await parser.getInfo(),pages=Array.from({length:Math.min(info.total,20)},(_,i)=>i+1);text=(await parser.getText({partial:pages})).pages.map(page=>page.text).join('\n');if(info.total>20)warnings.push(`Прочитаны первые 20 из ${info.total} страниц / ${info.total} беттің алғашқы 20 беті оқылды`);}finally{await parser.destroy();}
 }else if(ext==='docx'||ext==='xlsx'){
  validateOfficeArchive(buffer);
  if(ext==='docx'){const mammoth=await import('mammoth');text=(await mammoth.extractRawText({buffer})).value;}
  else{const {default:ExcelJS}=await import('exceljs');const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(buffer as never);const rows:string[]=[];let cutRows=false,cutColumns=false;for(const sheet of workbook.worksheets.slice(0,8)){const values:string[]=[];sheet.eachRow((row,n)=>{if(n>400){cutRows=true;return;}if(row.cellCount>24)cutColumns=true;const cells:string[]=[];for(let col=1;col<=Math.min(row.cellCount,24);col++)cells.push(row.getCell(col).text);if(cells.some(cell=>cell.trim()))values.push(cells.join('\t'));});if(values.length)rows.push(`[${sheet.name}]`,...values);}if(workbook.worksheets.length>8)warnings.push('Прочитаны первые 8 листов / Алғашқы 8 парақ оқылды');if(cutRows)warnings.push('Прочитаны первые 400 строк каждого листа / Әр парақтың алғашқы 400 жолы оқылды');if(cutColumns)warnings.push('Прочитаны первые 24 столбца / Алғашқы 24 баған оқылды');text=rows.join('\n');}
 }else if(['txt','csv'].includes(ext||'')){try{text=new TextDecoder('utf-8',{fatal:true}).decode(buffer);}catch{throw new AttachmentError('Сохраните текст/CSV в UTF-8 / Мәтінді немесе CSV файлын UTF-8 пішімінде сақтаңыз');}}
 else throw new AttachmentError('Поддерживаются PDF, DOCX, XLSX, CSV, TXT, JPG, PNG, WEBP / Осы пішімдерге қолдау бар',415);
 if(!text.trim())throw new AttachmentError(`Не найден читаемый текст. Для скана загрузите JPG/PNG / Мәтін табылмады. Сканды JPG/PNG ретінде жүктеңіз: ${name}`);
 if(text.length>TEXT_CHARACTERS)warnings.push('Прочитаны первые 16 000 символов. Разделите файл для остальных позиций / Алғашқы 16 000 таңба оқылды. Қалған тауарлар үшін файлды бөліңіз');
 return{name,type:file.type||'text/plain',text:text.slice(0,TEXT_CHARACTERS),...(warnings.length?{warning:warnings.join('. '),truncated:true}:{})};
}
