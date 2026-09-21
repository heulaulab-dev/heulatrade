import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getSecurities } from '@/lib/market/server'
import { allowRequest, apiError, requestKey } from '@/lib/api/http'

const Search = z.string().trim().max(80)
export async function GET(request: Request) {
  const requestId = crypto.randomUUID()
  if (!allowRequest(requestKey(request, 'security-search'), 30)) return NextResponse.json({ error: 'RATE_LIMITED', requestId }, { status: 429 })
  const query = Search.safeParse(new URL(request.url).searchParams.get('q') ?? '')
  if (!query.success) return NextResponse.json({ error: 'INVALID_QUERY', requestId }, { status: 400 })
  try {
    const result = await getSecurities(query.data)
    return NextResponse.json(result, { headers: { 'x-request-id': requestId } })
  } catch (error) { return apiError(error, requestId) }
}
