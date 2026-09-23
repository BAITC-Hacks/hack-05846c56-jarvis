import { NextRequest, NextResponse } from 'next/server';
import { getProduct, getAnalogProducts } from '@/lib/catalog';
export const runtime='nodejs';
export async function GET(request:NextRequest,{params}:{params:Promise<{id:string}>}){const {id}=await params;const product=await getProduct(id,{fresh:request.nextUrl.searchParams.get('fresh')!=='false'});const analogs=product?await getAnalogProducts(id):[];return product?NextResponse.json({product,alternatives:analogs.map(x=>x.product),analogEvidence:analogs}):NextResponse.json({error:'Товар не найден / Тауар табылмады'},{status:404});}
