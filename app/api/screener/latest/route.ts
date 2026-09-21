import { marketRoute } from '@/lib/market/arjum/route'
import { getScreener } from '@/lib/market/arjum/server'
export async function GET(request: Request) { return marketRoute(() => getScreener(request.signal)) }
