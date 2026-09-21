import { NextResponse } from 'next/server'
import { checkCapabilities } from '@/lib/market/server'

export async function GET() {
  const dependencies = {
    supabase: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
    market: false,
  }

  const url = process.env.MARKET_API_URL
  if (url) {
    try {
      const response = await fetch(`${url.replace(/\/$/, '')}/health`, {
        signal: AbortSignal.timeout(3000),
        cache: 'no-store'
      })
      dependencies.market = response.ok
    } catch {
      dependencies.market = false
    }
  }

  // Get actual capabilities
  let capabilities = null
  try {
    capabilities = await checkCapabilities()
  } catch (error) {
    console.error('Failed to check capabilities:', error)
  }

  const isReady = dependencies.supabase && (dependencies.market || capabilities !== null)

  return NextResponse.json({
    ready: isReady,
    dependencies,
    capabilities: capabilities || {
      security_master: 'UNAVAILABLE',
      latest_market: 'UNAVAILABLE',
      historical_ohlcv: 'UNAVAILABLE',
      index_summary: 'UNAVAILABLE',
      foreign_flow: 'UNAVAILABLE',
      broker_market_flow: 'UNAVAILABLE',
      news: 'UNAVAILABLE',
      announcements: 'UNAVAILABLE',
      latestTradingDate: null,
    },
  }, {
    status: isReady ? 200 : 503
  })
}
