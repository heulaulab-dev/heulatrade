import { marketRoute } from '@/lib/market/arjum/route'
import { getProviderHealth } from '@/lib/market/arjum/server'
export async function GET(request: Request) { return marketRoute(() => getProviderHealth(request.signal)) }
