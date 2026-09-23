import { NextRequest, NextResponse } from 'next/server';
import { searchProducts, catalogMeta, catalogCategories } from '@/lib/catalog';
export const runtime='nodejs';
export async function GET(request:NextRequest){const q=(request.nextUrl.searchParams.get('q')||'').slice(0,300);const limit=Math.max(1,Math.min(24,Number(request.nextUrl.searchParams.get('limit'))||12));const category=request.nextUrl.searchParams.get('category')||undefined;const products=await searchProducts(q,{limit,category,inStock:request.nextUrl.searchParams.get('inStock')==='true'});return NextResponse.json({products,total:q||category?products.length:catalogMeta().count,categories:catalogCategories(),meta:catalogMeta()});}
