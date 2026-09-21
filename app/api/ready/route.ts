import { NextResponse } from 'next/server'
export async function GET() {
  const dependencies = { supabase: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY), market: false }
  const url = process.env.MARKET_API_URL
  if (url) {
    try { const response = await fetch(`${url.replace(/\/$/, '')}/ready`, { signal: AbortSignal.timeout(3000), cache: 'no-store' }); dependencies.market = response.ok }
    catch { dependencies.market = false }
  }
  return NextResponse.json({ ready: dependencies.supabase && dependencies.market, dependencies }, { status: dependencies.supabase && dependencies.market ? 200 : 503 })
}
