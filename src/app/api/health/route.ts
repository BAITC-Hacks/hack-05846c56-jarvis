import {NextResponse} from 'next/server';
export const dynamic='force-dynamic';
export async function GET(){return NextResponse.json({status:'ok',service:'jarvis-ekt',aiConfigured:Boolean(process.env.OPENAI_API_KEY),catalogConfigured:Boolean(process.env.EKT_API_USERNAME&&process.env.EKT_API_PASSWORD),cartConfigured:Boolean(process.env.CART_SECRET&&process.env.CART_SECRET.length>=32)},{headers:{'Cache-Control':'no-store'}});}
