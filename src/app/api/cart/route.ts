import { NextRequest, NextResponse } from 'next/server';
import { hydrateCart } from '@/lib/cart';
import { readCart,writeCart,cartFailure } from '@/lib/cart-http';
import { getProduct } from '@/lib/catalog';
export const dynamic='force-dynamic';
export async function GET(req:NextRequest){try{const stored=readCart(req);return writeCart(NextResponse.json({cart:await hydrateCart(stored,id=>getProduct(id)),cartUrl:'/cart'}),stored);}catch(e){return cartFailure(e);}}
