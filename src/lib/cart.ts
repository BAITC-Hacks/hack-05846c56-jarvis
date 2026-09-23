import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import type { Cart, CartLine, Product } from './types';

export type Operation = 'add' | 'set' | 'remove';
export interface StoredCart { id: string; revision: number; items: { id: string; quantity: number }[]; updatedAt: string; }
export interface Proposal { purpose: 'proposal'; sessionId: string; revision: number; operation: Operation; items: {id:string;quantity:number;price:number|null}[]; expiresAt: number; nonce: string; }
export class CartError extends Error { constructor(message:string, public status=400, public code='INVALID_CART'){super(message);} }
const MAX_LINES=35;
function secret(){ const s=process.env.CART_SECRET; if(!s || s.length<32) throw new CartError('Сервис корзины не настроен / Себет қызметі бапталмаған',503,'CONFIGURATION'); return s; }
export function sign(value:unknown):string { const payload=Buffer.from(JSON.stringify(value)).toString('base64url'); return payload+'.'+createHmac('sha256',secret()).update(payload).digest('base64url'); }
export function verify<T>(value:string|undefined):T|null { if(!value || value.length>12000)return null; const [payload,signature,...rest]=value.split('.'); if(!payload||!signature||rest.length)return null; const expected=createHmac('sha256',secret()).update(payload).digest(); const actual=Buffer.from(signature,'base64url'); if(expected.length!==actual.length || !timingSafeEqual(expected,actual))return null; try{return JSON.parse(Buffer.from(payload,'base64url').toString()) as T;}catch{return null;} }
export function newCart():StoredCart{return {id:randomUUID(),revision:0,items:[],updatedAt:new Date().toISOString()};}
export function decodeCart(value:string|undefined):StoredCart|null {const c=verify<StoredCart & {purpose?:string}>(value); if(!c || !c.id || !Number.isInteger(c.revision)||!Array.isArray(c.items)||c.items.length>MAX_LINES || c.purpose)return null; if(c.items.some(x=>!x.id||!Number.isFinite(x.quantity)||x.quantity<=0))return null; return c;}
export function minimum(product:Product){const n=Number(String(product.specs.KRATNOST_MIN || '1').replace(',','.'));return Number.isFinite(n)&&n>0?n:1;}
export function validateQuantity(product:Product,quantity:number){ if(!Number.isFinite(quantity)||quantity<=0||quantity>1000000)throw new CartError('Укажите корректное количество / Дұрыс санын көрсетіңіз'); const step=minimum(product); if(Math.abs(quantity/step-Math.round(quantity/step))>0.00001)throw new CartError(`Количество должно быть кратно ${step} / Саны ${step} еселі болуы керек`,400,'MINIMUM_QUANTITY'); if(product.source!=='live')throw new CartError('Не удалось проверить актуальный остаток. Повторите позже / Ағымдағы қалдықты тексеру мүмкін болмады',503,'STOCK_UNAVAILABLE'); if(quantity>product.stock)throw new CartError(`Доступно ${product.stock} ${product.unit}: ${product.name}. Измените количество / Қолжетімді саннан асып кетті`,409,'INSUFFICIENT_STOCK'); if(product.price===null||!Number.isFinite(product.price)||product.price<0)throw new CartError('Цена требует уточнения у менеджера / Бағаны менеджерден нақтылаңыз',409,'PRICE_UNAVAILABLE'); }
export async function hydrateCart(cart:StoredCart,resolve:(id:string)=>Promise<Product|null>):Promise<Cart>{const items:CartLine[]=[];for(const item of cart.items){const product=await resolve(item.id);if(!product)throw new CartError('Не удалось загрузить товар корзины / Себет тауарын жүктеу мүмкін болмады',503);items.push({product,quantity:item.quantity});}return {id:cart.id,items,total:Math.round(items.reduce((sum,x)=>sum+(x.product.price??0)*x.quantity,0)*100)/100,updatedAt:cart.updatedAt,mode:'prototype'};}
export async function prepare(cart:StoredCart,items:{productId:string;quantity:number}[],operation:Operation,resolve:(id:string)=>Promise<Product|null>){
 if(!['add','set','remove'].includes(operation)||!Array.isArray(items)||!items.length||items.length>MAX_LINES)throw new CartError('Некорректный состав корзины / Себет құрамы дұрыс емес');
 if(new Set(items.map(x=>x.productId)).size!==items.length)throw new CartError('Товар повторяется / Тауар қайталанады');
 const lines:CartLine[]=[]; const proposed:Proposal['items']=[];
 for(const item of items){if(!item.productId||!/^\d+$/.test(item.productId))throw new CartError('Некорректный товар / Тауар дұрыс емес');const product=await resolve(item.productId);if(!product)throw new CartError('Товар не найден / Тауар табылмады',404);const existing=cart.items.find(x=>x.id===item.productId)?.quantity??0;
 if(operation==='remove'){if(!existing)throw new CartError('Товара нет в корзине / Тауар себетте жоқ',404);}else{validateQuantity(product,item.quantity);validateQuantity(product,operation==='add'?existing+item.quantity:item.quantity);}
 lines.push({product,quantity:operation==='remove'?existing:item.quantity});proposed.push({id:product.id,quantity:operation==='remove'?existing:item.quantity,price:product.price});}
 const resultingIds=new Set(cart.items.map(x=>x.id));for(const x of proposed){if(operation==='remove')resultingIds.delete(x.id);else resultingIds.add(x.id);}if(resultingIds.size>MAX_LINES)throw new CartError(`В корзине максимум ${MAX_LINES} позиций / Себетте ең көбі ${MAX_LINES} тауар`);
 const proposal:Proposal={purpose:'proposal',sessionId:cart.id,revision:cart.revision,operation,items:proposed,expiresAt:Date.now()+10*60*1000,nonce:randomUUID()};
 return {proposal,lines,token:sign(proposal)};
}
export async function confirm(cart:StoredCart,token:string,pendingNonce:string|undefined,confirmed:unknown,resolve:(id:string)=>Promise<Product|null>){
 if(confirmed!==true)throw new CartError('Нужно явное подтверждение / Нақты растау қажет',400,'CONFIRMATION_REQUIRED');
 const proposal=verify<Proposal>(token); if(!proposal||proposal.purpose!=='proposal'||proposal.sessionId!==cart.id||proposal.nonce!==pendingNonce)throw new CartError('Подтверждение недействительно. Выберите товар снова / Растау жарамсыз',403,'INVALID_CONFIRMATION');
 if(proposal.expiresAt<Date.now())throw new CartError('Время подтверждения истекло / Растау уақыты аяқталды',409,'EXPIRED');
 if(proposal.revision!==cart.revision)throw new CartError('Корзина изменилась. Подтвердите заново / Себет өзгерді. Қайта растаңыз',409,'CART_CHANGED');
 const updated=structuredClone(cart);const fresh=new Map<string,Product>();
 for(const item of proposal.items){const product=await resolve(item.id);if(!product)throw new CartError('Товар временно недоступен / Тауар уақытша қолжетімсіз',503);fresh.set(item.id,product);const index=updated.items.findIndex(x=>x.id===item.id);const existing=index<0?0:updated.items[index].quantity;
 if(proposal.operation==='remove'){if(index>=0)updated.items.splice(index,1);continue;}
 const quantity=proposal.operation==='add'?existing+item.quantity:item.quantity;validateQuantity(product,quantity);
 if(product.price!==item.price)throw new CartError('Цена изменилась. Просмотрите товар и подтвердите снова / Баға өзгерді. Қайта растаңыз',409,'PRICE_CHANGED');
 if(index<0)updated.items.push({id:item.id,quantity});else updated.items[index].quantity=quantity;
 }
 updated.revision++;updated.updatedAt=new Date().toISOString();return {stored:updated,fresh};
}
