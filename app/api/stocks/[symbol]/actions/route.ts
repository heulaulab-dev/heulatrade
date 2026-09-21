import { NextResponse } from 'next/server'
import { SymbolSchema } from '@/lib/market/contracts'
import { getActions } from '@/lib/market/server'
import { allowRequest, apiError, requestKey } from '@/lib/api/http'
export async function GET(request: Request, context: { params: Promise<{ symbol: string }> }) {
  const requestId = crypto.randomUUID()
  if (!allowRequest(requestKey(request, 'actions'))) return NextResponse.json({ error: 'RATE_LIMITED', requestId }, { status: 429 })
  const symbol = SymbolSchema.safeParse((await context.params).symbol)
  if (!symbol.success) return NextResponse.json({ error: 'INVALID_SYMBOL', requestId }, { status: 400 })
  try { return NextResponse.json(await getActions(symbol.data), { headers: { 'x-request-id': requestId, 'cache-control': 'private, max-age=300' } }) }
  catch (error) { return apiError(error, requestId) }
}
