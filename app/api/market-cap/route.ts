import { dateSchema, optionalParam, positiveInt } from '@/lib/market/arjum/inputs'
import { marketRoute } from '@/lib/market/arjum/route'
import { getMarketCap } from '@/lib/market/arjum/server'
export async function GET(request: Request) { return marketRoute(() => { const p = new URL(request.url).searchParams; const date = optionalParam(p, 'date'); const page = optionalParam(p, 'page'); const perPage = optionalParam(p, 'per_page'); return getMarketCap({ date: date ? dateSchema.parse(date) : undefined, page: page ? positiveInt.parse(page) : undefined, perPage: perPage ? positiveInt.max(250).parse(perPage) : undefined }, request.signal) }) }
