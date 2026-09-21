import { NextResponse } from 'next/server'
import { SymbolSchema } from '@/lib/market/contracts'
import { getStock } from '@/lib/market/server'
import { allowRequest, apiError, requestKey } from '@/lib/api/http'

export async function GET(request: Request, context: { params: Promise<{ symbol: string }> }) {
  const requestId = crypto.randomUUID()
  if (!allowRequest(requestKey(request, 'stock'))) return NextResponse.json({ error: 'RATE_LIMITED', requestId }, { status: 429 })
  const parsed = SymbolSchema.safeParse((await context.params).symbol)
  if (!parsed.success) return NextResponse.json({ error: 'INVALID_SYMBOL', requestId }, { status: 400 })
  try {
    const result = await getStock(parsed.data)
    return NextResponse.json(result, { headers: { 'x-request-id': requestId, 'cache-control': 'private, max-age=30' } })
  } catch (error) { return apiError(error, requestId) }
}
