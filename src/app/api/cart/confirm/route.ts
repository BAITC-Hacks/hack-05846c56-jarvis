import { NextRequest,NextResponse } from 'next/server';
import { confirm,hydrateCart,CartError } from '@/lib/cart';
import { readCart,writeCart,cartFailure,ensureOrigin,PENDING_COOKIE } from '@/lib/cart-http';
import { getProduct } from '@/lib/catalog';
export const maxDuration=45;
export async function POST(req:NextRequest){try{ensureOrigin(req);const body=await req.json();if(typeof body.token!=='string'||body.token.length>12000)throw new CartError('Подтверждение отсутствует / Растау жоқ');const stored=readCart(req);const result=await confirm(stored,body.token,req.cookies.get(PENDING_COOKIE)?.value,body.confirmed,id=>getProduct(id,{fresh:true}));const cart=await hydrateCart(result.stored,async id=>result.fresh.get(id)??await getProduct(id));const res=writeCart(NextResponse.json({cart,cartUrl:'/cart'}),result.stored);res.cookies.delete(PENDING_COOKIE);return res;}catch(e){return cartFailure(e);}}
