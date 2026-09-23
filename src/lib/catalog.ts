import snapshot from '../../data/catalog-snapshot.json';
import index from '../../data/catalog-index.json';
import type { Product } from './types';

type Raw = Record<string, unknown>;
const labels: Record<string,string> = { NOMINALNYY_TOK:'Номинальный ток',KOLICHESTVO_POLYUSOV:'Количество полюсов',NOMINALNOE_NAPRYAZHENIE:'Номинальное напряжение',NOMINALNAYA_OTKLYUCHAYUSHCHAYA_SPOSOBNOST:'Отключающая способность',TORGOVAYA_MARKA:'Торговая марка',KRATNOST_MIN:'Минимальная кратность',ARTIKULPOSTAVSHCHIKA:'Артикул производителя',SECHENIE_MM2:'Сечение, мм²',KOLICHESTVO_ZHIL:'Количество жил',STEPEN_ZASHCHITY:'Степень защиты',MOSHCHNOST:'Мощность',TSOKOL:'Цоколь',MATERIAL_ZHILY:'Материал жилы',TIP_USTANOVKI:'Тип установки',KHARAKTERISTIKA_SRABATYVANIYA:'Характеристика срабатывания',GIBKOST:'Гибкость',NAZNACHENIE:'Назначение',MATERIAL_IZOLYATSII_I_OBOLOCHKI:'Изоляция и оболочка',NALICHIE_METALLICHESKOY_BRONI:'Металлическая броня'};
export const plainText = (s:unknown) => String(s ?? '').replace(/<[^>]*>/g,' ').replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/&nbsp;/g,' ').replace(/&#39;/g,"'").replace(/\s+/g,' ').trim();
const num=(v:unknown)=>{const n=Number(String(v??'').replace(',','.'));return Number.isFinite(n)?n:0;};
function priceValue(v:unknown){if(v==null||String(v).trim()==='')return null;const n=Number(String(v).replace(',','.'));return Number.isFinite(n)&&n>=0?n:null;}
function safeURL(v:unknown):string|null {try {const u=new URL(String(v));return ['https:','http:'].includes(u.protocol) && (u.hostname==='ekt.kz'||u.hostname.endsWith('.ekt.kz'))?u.href:null;}catch{return null;}}
export function normalizeProduct(raw:Raw, source:Product['source']='snapshot', fetchedAt=new Date().toISOString()):Product {
 const props=(raw.properties||{}) as Raw;const specs:Record<string,string>={};
 for(const [key,value] of Object.entries(props)){if(value==null||typeof value==='object'||/^(CML2_TRAITS|RECOMMEND|IMYAKARTINKI|BRAND_PRIORITY)/.test(key))continue;const text=plainText(value);if(text){specs[key]=text;if(labels[key])specs[labels[key]]=text;}}
 if(!specs.NOMINALNOE_NAPRYAZHENIE&&specs.NAPRYAZHENIE){specs.NOMINALNOE_NAPRYAZHENIE=specs.NAPRYAZHENIE;specs['Номинальное напряжение']=specs.NAPRYAZHENIE;}
 const name=plainText(raw.name);const nameAmps=name.match(/(?:^|\s)(\d+(?:[.,]\d+)?)\s*[AА](?![a-zа-я])/i)?.[1];const propAmps=String(props.NOMINALNYY_TOK||'').match(/[\d.,]+/)?.[0];
 const curve=name.match(/(?:^|\s)([BCDСВД])\s+(?=\d)/i)?.[1]||name.match(/\s([BCDСВД])(?:\s|$)/i)?.[1];if(!specs.KHARAKTERISTIKA_SRABATYVANIYA&&curve){specs.KHARAKTERISTIKA_SRABATYVANIYA=curve.toUpperCase().replace('С','C').replace('В','B').replace('Д','D');specs['Характеристика срабатывания (из названия)']=specs.KHARAKTERISTIKA_SRABATYVANIYA;}
 if(nameAmps&&propAmps&&num(nameAmps)!==num(propAmps))specs['Проверка данных']=`Противоречие источника: в названии ${nameAmps} А, в свойствах ${propAmps} А. Совместимость необходимо уточнить у менеджера.`;
 const dimension=name.match(/(?:^|\s)(\d+)\s*[хx×]\s*(\d+(?:[.,]\d+)?)/i);if(dimension){const conflicts=[];if(specs.KOLICHESTVO_ZHIL&&num(specs.KOLICHESTVO_ZHIL)!==num(dimension[1]))conflicts.push(`жил в названии ${dimension[1]}, в свойствах ${specs.KOLICHESTVO_ZHIL}`);if(specs.SECHENIE_MM2&&num(specs.SECHENIE_MM2)!==num(dimension[2]))conflicts.push(`сечение в названии ${dimension[2]}, в свойствах ${specs.SECHENIE_MM2}`);if(conflicts.length)specs['Проверка данных']='Противоречие источника: '+conflicts.join('; ')+'. Нужна проверка менеджера.';}
 const namePoles=name.match(/(?:^|\s)([1-4])\s*[pрф](?:\s|$)/i)?.[1];if(namePoles&&specs.KOLICHESTVO_POLYUSOV&&num(namePoles)!==num(specs.KOLICHESTVO_POLYUSOV))specs['Проверка данных']=`Противоречие источника: в названии ${namePoles} полюса, в свойствах ${specs.KOLICHESTVO_POLYUSOV}. Нужна проверка менеджера.`;
 const stores=Array.isArray(raw.stores)?raw.stores as Raw[]:[];
 const url=safeURL(raw.url)||'https://ekt.kz/catalog/';
 const categories:Record<string,string>={nizkovoltnaya_apparatura:'Автоматы и защита',kabel_provod:'Кабель и провод',rozetki_vyklyuchateli_korobki:'Розетки и выключатели',kabelenesushchie_sistemy:'Кабеленесущие системы',avtomatizatsiya:'Автоматизация',svetilniki_lampy:'Освещение',izdeliya_dlya_montazha_instrument:'Монтаж и инструмент',shkafy_shchity:'Щиты и корпуса',videonablyudenie_skud_signalizatsiya:'Системы безопасности'};
 const category=/(?:^|\s)(АВ|ВА|АВДТ|УЗО|автомат)(?:\s|\()/i.test(name)?'Автоматы и защита':/ВВГ|ВБб|ПВС|ШВВП|КВВГ/i.test(name)?'Кабель и провод':/LED|ламп|светильник/i.test(name)?'Освещение':Object.entries(categories).find(([key])=>url.includes('/'+key+'/'))?.[1]||'Электрооборудование';
 const certificates:{name:string;url:string}[]=[];
 for(const [key,val] of Object.entries(props)){if(/sert|cert|сертификат/i.test(key)){for(const v of Array.isArray(val)?val:[val]){const link=safeURL(typeof v==='object'&&v?((v as Raw).url||(v as Raw).SRC):v);if(link)certificates.push({name:'Сертификат EKT',url:link});}}}
 const meter=String(props.METRAZHNYY_TOVAR||'').toLowerCase()==='да';
 return {id:String(raw.id),sku:plainText(raw.article||props.CML2_ARTICLE||raw.id),name,category,brand:plainText(props.TORGOVAYA_MARKA)||(/Legrand/i.test(name)?'Legrand':/SchnEl|Schneider/i.test(name)?'Schneider Electric':/IEK/i.test(name)?'IEK':/EKT|ЕКТ/i.test(name)?'EKT':''),price:priceValue(raw.price),currency:'KZT',stock:Math.max(0,num(raw.quantity)),unit:meter?'м':'шт',image:safeURL(raw.image),url,description:plainText(raw.description),specs,certificates,warehouses:stores.map(s=>({name:plainText(s.name),stock:Math.max(0,num(s.quantity))})).filter(s=>s.stock>0),source,fetchedAt:String(raw._fetchedAt||fetchedAt)};
}
const products:Product[]=snapshot.items.map(p=>normalizeProduct(p as Raw,'snapshot',snapshot.fetchedAt));
const detailedIds=new Set(products.map(p=>p.id));
const candidates=[...products,...index.items.filter(p=>!detailedIds.has(String(p.id))).map(p=>normalizeProduct(p as Raw,'snapshot',index.fetchedAt))];
const memory=new Map<string,Product>();
export const catalogMeta=()=>({count:candidates.length,detailedCount:products.length,fetchedAt:snapshot.fetchedAt,source:'snapshot',coverage:'Индекс каталога EKT с актуализацией найденных карточек через API.'});
export function allProducts(){return products;}
export async function getProduct(id:string,options:{fresh?:boolean}={}):Promise<Product|null>{
 if(!/^\d{1,12}$/.test(id))return null;
 if(!options.fresh){const cached=memory.get(id);if(cached&&Date.now()-Date.parse(cached.fetchedAt)<60000)return cached;const local=products.find(p=>p.id===id);if(local)return local;}
 if(process.env.EKT_API_USERNAME&&process.env.EKT_API_PASSWORD){try{const base=(process.env.EKT_API_URL||'https://ekt.kz/api').replace(/\/$/,'');const r=await fetch(`${base}/products/detail?id=${id}`,{headers:{Authorization:'Basic '+Buffer.from(`${process.env.EKT_API_USERNAME}:${process.env.EKT_API_PASSWORD}`).toString('base64')},cache:'no-store',signal:AbortSignal.timeout(10000)});if(r.ok){const raw=await r.json();if(String(raw.id)===id){const p=normalizeProduct(raw,'live');memory.set(id,p);return p;}}}catch{/* Caller sees explicitly dated snapshot on outage. */}}
 return products.find(p=>p.id===id)||null;
}
export function normalizeQuery(value:string){return value.toLowerCase().replace(/ё/g,'е').replace(/кабельдер|сымдар|сым\b/gu,'кабель').replace(/ажыратқыш/gu,'автомат').replace(/розеткалар/gu,'розетка').replace(/шамдар|жарықдиодты|жарық/gu,'лампа').replace(/қалқан/gu,'щит').replace(/қорап/gu,'коробка').replace(/қысқыш/gu,'клемма').replace(/schneider|шнайдер/gi,'schnel').replace(/легранд/gi,'legrand').replace(/([0-9])[хx×]([0-9])/g,'$1x$2').replace(/([0-9])[,.]([0-9])/g,'$1.$2').replace(/([0-9])\s*[аa](?![а-яa-z])/g,'$1a').replace(/[^\p{L}\p{N}._x]+/gu,' ').trim();}
const stop=new Set(['найди','нужен','нужна','нужно','мне','для','есть','ли','покажи','подбери','товар','купить','в','на','и','по','с','до','из','шт','штук','какой','какие','бар','керек','маған','тауып','бер','да','нет','добавь','корзину','хочу','пожалуйста']);
export function searchLocal(query:string,options:{limit?:number;inStock?:boolean;category?:string;maxPrice?:number}={}):Product[]{
 const q=normalizeQuery(query);const tokens=q.split(/\s+/).filter(t=>t.length>1&&!stop.has(t));const amp=q.match(/(?:^|\s)(\d+(?:\.\d+)?)a(?:$|\s)/)?.[1];
 const exactProduct=candidates.find(p=>[p.id,p.sku,p.specs.ARTIKULPOSTAVSHCHIKA,p.name.match(/^\S+/)?.[0]].filter(Boolean).some(v=>normalizeQuery(v!)===q));if(exactProduct&&(!options.inStock||exactProduct.stock>0)&&(options.maxPrice==null||(exactProduct.price!=null&&exactProduct.price<=options.maxPrice)))return[exactProduct];
 const dimension=q.match(/\d+x\d+(?:\.\d+)?/)?.[0];
 const poles=q.match(/(?:^|\s)([1-4])\s*[pрф](?:$|\s)/)?.[1];
 const wantedCategory=/кабел|\bпровод|ввг|вббш|пвс|шввп/.test(q)?'Кабель и провод':/автомат|^ав |^ва |узо|авдт|дифавтомат/.test(q)?'Автоматы и защита':/розетк|выключател|коробк/.test(q)?'Розетки и выключатели':/ламп|светильник|светодиод/.test(q)?'Освещение':null;
 const ranked=candidates.filter(p=>(!options.inStock||p.stock>0)&&(!wantedCategory||p.category===wantedCategory)&&(!options.category||options.category===p.category)&&(options.maxPrice==null||(p.price!=null&&p.price<=options.maxPrice))).map(p=>{const name=normalizeQuery(p.name);const text=normalizeQuery(`${p.name} ${p.category} ${p.brand} ${p.description} ${Object.values(p.specs).join(' ')}`);let score=0;const exact=[p.id,p.sku,p.specs.ARTIKULPOSTAVSHCHIKA].filter(Boolean).map(normalizeQuery);if(exact.some(x=>q===x||tokens.includes(x)))score+=1000;
 for(const token of tokens){if(name.includes(token))score+=12;else if(text.includes(token))score+=4;else if(token.length>=5&&text.includes(token.slice(0,-2)))score+=2;}
 if(amp){const pa=normalizeQuery(p.specs.NOMINALNYY_TOK||'').replace(/\s/g,'');if(pa!==amp+'a'&&!new RegExp('(?:^|\\s)'+amp.replace('.','\\.')+'a(?:$|\\s)').test(name))score=-1;}
 if(dimension&&!name.replace(/\s/g,'').includes(dimension))score=-1;
 if(poles&&String(p.specs.KOLICHESTVO_POLYUSOV)!==poles&&!new RegExp('(?:^|\\s)'+poles+'[pрф](?:$|\\s)').test(name))score=-1;
 if(poles&&new RegExp(poles+'[pрф]\\s*\\+\\s*n','i').test(p.name)&&!/[pрф]\s*\+\s*n/i.test(query))score=-1;
 if(/автомат/.test(q)&&!/диф|авдт|узо/.test(q)&&/АВДТ|УЗО|диф|АД14/i.test(p.name))score=-1;
 if((amp||poles)&&p.specs['Проверка данных'])score=-1;
 if(!tokens.length)score=1;if(score>0&&p.stock>0)score+=1;return{p,score};}).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||Number(!!b.p.image)-Number(!!a.p.image));
 return ranked.slice(0,Math.min(options.limit??12,60)).map(x=>x.p);
}
export async function searchProducts(query:string,options:{limit?:number;inStock?:boolean;category?:string;maxPrice?:number}={}):Promise<Product[]>{const local=searchLocal(query,{...options,inStock:false,limit:Math.min(options.limit??12,24)});if(/^\d{4,12}$/.test(query.trim())&&!local.some(p=>p.id===query.trim()||p.sku===query.trim())){const p=await getProduct(query.trim(),{fresh:true});if(p&&(options.maxPrice==null||(p.price!=null&&p.price<=options.maxPrice)))return[p];}const resolved=await Promise.all(local.map(p=>detailedIds.has(p.id)||memory.has(p.id)?getProduct(p.id):getProduct(p.id,{fresh:true})));return resolved.filter((p):p is Product=>!!p&&(!options.inStock||p.stock>0)&&(options.maxPrice==null||(p.price!=null&&p.price<=options.maxPrice)));}
export const catalogCategories=()=>[...new Set(candidates.map(p=>p.category))].sort();
const criticalByCategory:Record<string,string[]>={'Автоматы и защита':['NOMINALNYY_TOK','KOLICHESTVO_POLYUSOV','NOMINALNOE_NAPRYAZHENIE','NOMINALNAYA_OTKLYUCHAYUSHCHAYA_SPOSOBNOST','KHARAKTERISTIKA_SRABATYVANIYA'],'Кабель и провод':['SECHENIE_MM2','KOLICHESTVO_ZHIL','MATERIAL_ZHILY','NOMINALNOE_NAPRYAZHENIE','MATERIAL_IZOLYATSII_I_OBOLOCHKI','NALICHIE_METALLICHESKOY_BRONI','GIBKOST','NAZNACHENIE'],'Освещение':['MOSHCHNOST','TSOKOL','NOMINALNOE_NAPRYAZHENIE']};
const normSpec=(v:string)=>v.toLowerCase().replace(/[,]/g,'.').replace(/\s/g,'').replace(/а/g,'a').replace(/в/g,'v');
export function compareAnalog(base:Product,candidate:Product):{compatible:boolean;reason:string;warnings:string[]}{
 const fail=(reason:string)=>({compatible:false,reason,warnings:[]});if(base.id===candidate.id||base.category!==candidate.category)return fail('Разная категория');if(candidate.stock<=0)return fail('Нет подтвержденного остатка в источнике');if(base.specs['Проверка данных']||candidate.specs['Проверка данных'])return fail('В карточке есть противоречивые характеристики');
 const keys=criticalByCategory[base.category];if(!keys)return fail('Недостаточно правил проверки совместимости для этой категории');
 const protectionType=(p:Product)=>/АВДТ|диф|АД14/i.test(p.name)?'rcbo':/УЗО|АД12/i.test(p.name)?'rcd':'breaker';if(base.category==='Автоматы и защита'&&protectionType(base)!==protectionType(candidate))return fail('Разные типы защиты');
 if(base.category==='Автоматы и защита'&&protectionType(base)!=='breaker')return fail('Требуется дополнительная проверка дифференциальной защиты');
 if(base.category==='Кабель и провод'){const family=(p:Product)=>p.name.match(/(?:^|\s)(ВВГ\S*|ВБ\S*|КВВГ\S*|ПВС|ПУНП|ПУГНП|ШВВП|КГ\S*)/i)?.[1]?.toUpperCase();if(!family(base)||family(base)!==family(candidate))return fail('Различаются конструкция или назначение кабеля');}
 if(keys.some(k=>!base.specs[k]||!candidate.specs[k]))return fail('Недостаточно критических характеристик для безопасного сравнения');
 const mismatches=keys.filter(k=>normSpec(base.specs[k])!==normSpec(candidate.specs[k]));if(mismatches.length)return fail(`Отличаются: ${mismatches.map(k=>labels[k]||k).join(', ')}`);
 return{compatible:true,reason:`Совпадают: ${keys.map(k=>`${labels[k]||k} — ${base.specs[k]}`).join('; ')}.`,warnings:['Это кандидат на замену. Габариты, монтаж, селективность и условия эксплуатации нужно проверить перед установкой.']};
}
export async function getAnalogProducts(id:string,limit=4){const base=await getProduct(id);if(!base)return[];const matches=[...new Map([...products,...memory.values()].map(p=>[p.id,p])).values()].map(product=>({product,...compareAnalog(base,product)})).filter(x=>x.compatible).sort((a,b)=>(a.product.price??Infinity)-(b.product.price??Infinity)).slice(0,limit);const refreshed=await Promise.all(matches.map(async x=>{const product=await getProduct(x.product.id,{fresh:true})||x.product;return{product,...compareAnalog(base,product)};}));return refreshed.filter(x=>x.compatible).map(({product,reason,warnings})=>({product,reason,warnings}));}

