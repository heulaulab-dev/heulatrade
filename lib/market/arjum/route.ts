import 'server-only'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ArjumError } from './errors'
import { ZodError } from 'zod'

export async function requireMarketUser() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) return null
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) throw new Response('Unauthorized', { status: 401 })
  return data.user
}

export async function marketRoute(run: () => Promise<unknown>) {
  const requestId = crypto.randomUUID()
  try {
    await requireMarketUser()
    return NextResponse.json(await run(), { headers: { 'cache-control': 'private, no-store', 'x-request-id': requestId } })
  } catch (error) {
    if (error instanceof Response) return NextResponse.json({ error: 'UNAUTHORIZED', requestId }, { status: error.status })
    if (error instanceof ZodError) return NextResponse.json({ error: 'INVALID_REQUEST', requestId }, { status: 400 })
    if (error instanceof ArjumError) return NextResponse.json({ error: error.code, requestId, retryAfterSeconds: error.retryAfterSeconds }, { status: error.status, headers: error.retryAfterSeconds ? { 'retry-after': String(error.retryAfterSeconds) } : undefined })
    console.error(JSON.stringify({ requestId, error: 'INTERNAL_ERROR' }))
    return NextResponse.json({ error: 'INTERNAL_ERROR', requestId }, { status: 500 })
  }
}
