import { optionalParam, positiveInt, symbolSchema } from '@/lib/market/arjum/inputs'
import { marketRoute } from '@/lib/market/arjum/route'
import { getFinancialStatements } from '@/lib/market/arjum/server'
import { z } from 'zod'
export async function GET(request: Request, context: { params: Promise<{ code: string }> }) { return marketRoute(async () => { const code = symbolSchema.parse((await context.params).code); const p = new URL(request.url).searchParams; const limit = optionalParam(p, 'limit'); return getFinancialStatements(code, { reportType: z.enum(['INCOME_STATEMENT', 'BALANCE_SHEET', 'CASH_FLOW']).optional().parse(optionalParam(p, 'report_type')), period: z.enum(['quarterly', 'annual']).optional().parse(optionalParam(p, 'period')), limit: limit ? positiveInt.parse(limit) : undefined, year: z.string().regex(/^\d{4}$/).optional().parse(optionalParam(p, 'year')) }, request.signal) }) }
