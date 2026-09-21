import { NextResponse } from 'next/server'
import { ScreenRequestSchema } from '@/lib/market/contracts'
import { runScreener } from '@/lib/market/server'
import { allowRequest, apiError, requestKey } from '@/lib/api/http'

export async function POST(request: Request) {
  const requestId = crypto.randomUUID()
  if (!allowRequest(requestKey(request, 'screener'), 30)) return NextResponse.json({ error: 'RATE_LIMITED', requestId }, { status: 429 })
  let input: unknown
  try { input = await request.json() } catch { return NextResponse.json({ error: 'INVALID_JSON', requestId }, { status: 400 }) }
  const parsed = ScreenRequestSchema.safeParse(input)
  if (!parsed.success) return NextResponse.json({ error: 'INVALID_CONDITIONS', requestId }, { status: 400 })
  try { return NextResponse.json(await runScreener(parsed.data), { headers: { 'x-request-id': requestId, 'cache-control': 'private, no-store' } }) }
  catch (error) { return apiError(error, requestId) }
}
