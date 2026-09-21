import { NextResponse } from 'next/server'
import { getSignals } from '@/lib/market/server'
import { allowRequest, apiError, requestKey } from '@/lib/api/http'
export async function GET(request: Request) {
  const requestId = crypto.randomUUID()
  if (!allowRequest(requestKey(request, 'signals'), 10)) return NextResponse.json({ error: 'RATE_LIMITED', requestId }, { status: 429 })
  try { return NextResponse.json(await getSignals(), { headers: { 'x-request-id': requestId, 'cache-control': 'private, max-age=300' } }) }
  catch (error) { return apiError(error, requestId) }
}
