import { optionalParam, positiveInt, symbolSchema } from '@/lib/market/arjum/inputs'
import { marketRoute } from '@/lib/market/arjum/route'
import { getInsiders } from '@/lib/market/arjum/server'
import { z } from 'zod'
export async function GET(request: Request, context: { params: Promise<{ code: string }> }) { return marketRoute(async () => { const code = symbolSchema.parse((await context.params).code); const p = new URL(request.url).searchParams; const page = optionalParam(p, 'page'); const limit = optionalParam(p, 'limit'); return getInsiders(code, { page: page ? positiveInt.parse(page) : undefined, limit: limit ? positiveInt.max(250).parse(limit) : undefined, actionType: z.enum(['buy', 'sell', 'cross']).optional().parse(optionalParam(p, 'action_type')) }, request.signal) }) }
