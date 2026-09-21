import { NextResponse } from 'next/server'
import { MarketError } from '@/lib/market/server'

const windows = new Map<string, { count: number; reset: number }>()
export function allowRequest(key: string, limit = 60): boolean {
  const now = Date.now()
  const entry = windows.get(key)
  if (!entry || entry.reset <= now) { windows.set(key, { count: 1, reset: now + 60_000 }); return true }
  if (entry.count >= limit) return false
  entry.count += 1
  return true
}
export function apiError(error: unknown, requestId: string) {
  const code = error instanceof MarketError ? error.code : 'INTERNAL_ERROR'
  const status = code === 'UNAVAILABLE' ? 503 : code === 'UPSTREAM_ERROR' ? 502 : 500
  console.error(JSON.stringify({ requestId, code, timestamp: new Date().toISOString() }))
  return NextResponse.json({ error: code, requestId }, { status, headers: { 'cache-control': 'no-store' } })
}
export function requestKey(request: Request, endpoint: string) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  return `${endpoint}:${ip}`
}
