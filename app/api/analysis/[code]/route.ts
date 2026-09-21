import { symbolSchema } from '@/lib/market/arjum/inputs'
import { marketRoute } from '@/lib/market/arjum/route'
import { getAnalysis } from '@/lib/market/arjum/server'
export async function GET(request: Request, context: { params: Promise<{ code: string }> }) { return marketRoute(async () => getAnalysis(symbolSchema.parse((await context.params).code), request.signal)) }
