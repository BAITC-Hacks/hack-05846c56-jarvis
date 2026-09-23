import { NextResponse } from 'next/server';
import { getAnalogProducts } from '@/lib/catalog';
export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){const {id}=await params;const analogs=await getAnalogProducts(id);return NextResponse.json({analogs});}
