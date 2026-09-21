import { z } from 'zod'
import { marketRoute } from '@/lib/market/arjum/route'
import { getSearch } from '@/lib/market/arjum/server'
export async function GET(request: Request) { return marketRoute(() => { const q = z.string().trim().min(1).max(80).parse(new URL(request.url).searchParams.get('q')); return getSearch(q, request.signal) }) }
