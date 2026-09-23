import { NextRequest,NextResponse } from 'next/server';
import { z } from 'zod';
import { prepare,hydrateCart,CartError } from '@/lib/cart';
import { readCart,writeCart,cartFailure,ensureOrigin,PENDING_COOKIE } from '@/lib/cart-http';
import { getProduct } from '@/lib/catalog';
export const maxDuration=45;
const schema=z.object({items:z.array(z.object({productId:z.string().regex(/^\d+$/),quantity:z.number().finite().positive().max(1000000)})).min(1).max(35),operation:z.enum(['add','set','remove']).default('add')});
export async function POST(req:NextRequest){try{ensureOrigin(req);const parsed=schema.safeParse(await req.json());if(!parsed.success)throw new CartError('Проверьте товары и количество / Тауарлар мен санын тексеріңіз');const stored=readCart(req);const {proposal,lines,token}=await prepare(stored,parsed.data.items,parsed.data.operation,id=>getProduct(id,{fresh:parsed.data.operation!=='remove'}));const res=writeCart(NextResponse.json({proposal:{token,items:lines,operation:proposal.operation,expiresAt:new Date(proposal.expiresAt).toISOString()},cart:await hydrateCart(stored,id=>getProduct(id))}),stored);res.cookies.set(PENDING_COOKIE,proposal.nonce,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/',maxAge:600});return res;}catch(e){return cartFailure(e);}}
