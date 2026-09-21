import { optionalParam, positiveInt, symbolSchema } from '@/lib/market/arjum/inputs'
import { marketRoute } from '@/lib/market/arjum/route'
import { getHistory } from '@/lib/market/arjum/server'
import { z } from 'zod'
export async function GET(request: Request, context: { params: Promise<{ code: string }> }) { return marketRoute(async () => { const code = symbolSchema.parse((await context.params).code); const p = new URL(request.url).searchParams; const limit = optionalParam(p, 'limit'); const frame = optionalParam(p, 'frame'); return getHistory(code, { limit: limit ? positiveInt.max(5000).parse(limit) : undefined, frame: frame ? z.enum(['daily', 'weekly', 'monthly']).parse(frame) : undefined }, request.signal) }) }
