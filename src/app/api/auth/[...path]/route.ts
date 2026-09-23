import { getAuth } from '@/lib/auth-server';
import { historyFailure } from '@/lib/history-http';
export const runtime = 'nodejs';
export const maxDuration = 30;
type Context = { params: Promise<{ path: string[] }> };
export async function GET(request: Request, context: Context) { try { return await getAuth().handler().GET(request, context); } catch (error) { return historyFailure(error); } }
export async function POST(request: Request, context: Context) { try { return await getAuth().handler().POST(request, context); } catch (error) { return historyFailure(error); } }
