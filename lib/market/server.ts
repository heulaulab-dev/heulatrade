import 'server-only'
import { z } from 'zod'
import {
  ActionSchema, CandleSchema, FundamentalsSchema, MarketOverviewSchema,
  MetaSchema, ProfileSchema, QuoteSchema, ScreenRequestSchema,
  ScreenResponseSchema, SecuritySchema, SignalsSchema, SymbolSchema
} from './contracts'
import {
  fetchSecurityMaster, fetchCompanyProfile, fetchNews,
  fetchAnnouncements, fetchStockSummary, fetchMarketOverview
} from './providers/direct'

const upstream = process.env.MARKET_API_URL?.replace(/\/$/, '')

export class MarketError extends Error {
  constructor(public code: 'UNAVAILABLE' | 'UPSTREAM_ERROR' | 'SCHEMA_DRIFT', message: string) { super(message) }
}

async function fetchUpstream(path: string): Promise<unknown> {
  if (!upstream) throw new MarketError('UNAVAILABLE', 'Market data service is not configured')
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)
  try {
    const response = await fetch(`${upstream}${path}`, { signal: controller.signal, next: { revalidate: 30 } })
    if (!response.ok) throw new MarketError('UPSTREAM_ERROR', `Market service returned ${response.status}`)
    return await response.json()
  } catch (error) {
    if (error instanceof MarketError) throw error
    throw new MarketError('UPSTREAM_ERROR', 'Market service could not be reached')
  } finally { clearTimeout(timeout) }
}

async function postUpstream(path: string, body: unknown): Promise<unknown> {
  if (!upstream) throw new MarketError('UNAVAILABLE', 'Market data service is not configured')
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)
  try {
    const result = await fetch(`${upstream}${path}`, { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' }, signal: controller.signal, cache: 'no-store' })
    if (!result.ok) throw new MarketError('UPSTREAM_ERROR', `Market service returned ${result.status}`)
    return result.json()
  } catch (error) {
    if (error instanceof MarketError) throw error
    throw new MarketError('UPSTREAM_ERROR', 'Market service could not be reached')
  } finally { clearTimeout(timeout) }
}

async function validated<T extends z.ZodTypeAny>(path: string, schema: T): Promise<z.infer<T>> {
  try {
    return schema.parse(await fetchUpstream(path))
  } catch (error) {
    if (error instanceof MarketError) throw error
    throw new MarketError('SCHEMA_DRIFT', 'Market response format changed')
  }
}

const SignalsResponse = z.object({ data: SignalsSchema, meta: MetaSchema })
const FundamentalsResponse = z.object({ data: FundamentalsSchema, meta: MetaSchema })
const ActionsResponse = z.object({ data: ActionSchema, meta: MetaSchema })

// ═══════════════════════════════════════════════════════════════════════════════
// DIRECT PROVIDERS (query market-api, NOT scraping IDX)
// ═══════════════════════════════════════════════════════════════════════════════

export async function getSecurities(q = ''): Promise<{ data: z.infer<typeof SecuritySchema>[]; meta: z.infer<typeof MetaSchema> }> {
  const result = await fetchSecurityMaster(q)

  return {
    data: result.data.map(item => ({
      symbol: item.symbol,
      companyName: item.companyName,
      sector: item.sector ?? null,
      subsector: item.subsector ?? null,
      board: item.board ?? null,
    })),
    meta: result.meta,
  }
}

export async function getStock(symbol: string): Promise<{ data: { quote: z.infer<typeof QuoteSchema>; candles: z.infer<typeof CandleSchema>[] }; meta: z.infer<typeof MetaSchema> }> {
  const result = await fetchStockSummary(symbol)

  return {
    data: {
      quote: result.data.quote as z.infer<typeof QuoteSchema>,
      candles: result.data.candles as z.infer<typeof CandleSchema>[],
    },
    meta: result.meta,
  }
}

export async function getProfile(symbol: string): Promise<{ data: z.infer<typeof ProfileSchema>; meta: z.infer<typeof MetaSchema> }> {
  const result = await fetchCompanyProfile(symbol)

  return {
    data: {
      symbol: result.data.symbol,
      companyName: result.data.companyName,
      website: result.data.website,
      description: result.data.description,
      directors: result.data.directors,
      commissioners: result.data.commissioners,
      shareholders: result.data.shareholders,
      subsidiaries: result.data.subsidiaries,
    },
    meta: result.meta,
  }
}

export async function getNews(pageNumber = 1, pageSize = 20): Promise<{ data: { tradingDate: string; foreignFlow: z.infer<typeof SignalsSchema>['foreignFlow'] }; meta: z.infer<typeof MetaSchema> & { page: number; totalPages: number } }> {
  const result = await fetchNews(pageNumber, pageSize)

  return {
    data: {
      tradingDate: result.meta.dataAsOf || new Date().toISOString().split('T')[0],
      foreignFlow: [],
    },
    meta: result.meta,
  }
}

export async function getAnnouncements(keywords = '', pageNumber = 1, pageSize = 20): Promise<{ data: { tradingDate: string; foreignFlow: z.infer<typeof SignalsSchema>['foreignFlow'] }; meta: z.infer<typeof MetaSchema> & { page: number; totalPages: number } }> {
  const result = await fetchAnnouncements(keywords, pageNumber, pageSize)

  return {
    data: {
      tradingDate: result.meta.dataAsOf || new Date().toISOString().split('T')[0],
      foreignFlow: [],
    },
    meta: result.meta,
  }
}

export async function getSignals(): Promise<{ data: z.infer<typeof SignalsSchema>; meta: z.infer<typeof MetaSchema> }> {
  return validated('/v1/signals', SignalsResponse)
}

export async function getOverview(): Promise<{ data: z.infer<typeof MarketOverviewSchema>; meta: z.infer<typeof MetaSchema> }> {
  const result = await fetchMarketOverview()

  return {
    data: result.data as z.infer<typeof MarketOverviewSchema>,
    meta: result.meta,
  }
}

export async function getFundamentals(symbol: string): Promise<{ data: z.infer<typeof FundamentalsSchema>; meta: z.infer<typeof MetaSchema> }> {
  return validated(`/v1/stocks/${encodeURIComponent(SymbolSchema.parse(symbol))}/fundamentals`, FundamentalsResponse)
}

export async function getActions(symbol: string): Promise<{ data: z.infer<typeof ActionSchema>; meta: z.infer<typeof MetaSchema> }> {
  return validated(`/v1/stocks/${encodeURIComponent(SymbolSchema.parse(symbol))}/actions`, ActionsResponse)
}

export async function runScreener(input: unknown) {
  const request = ScreenRequestSchema.parse(input)
  try { return ScreenResponseSchema.parse(await postUpstream('/v1/screener', request)) }
  catch (error) {
    if (error instanceof MarketError) throw error
    throw new MarketError('SCHEMA_DRIFT', 'Screener response format changed')
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CAPABILITY CHECK
// ═══════════════════════════════════════════════════════════════════════════════

export async function checkCapabilities(): Promise<{
  security_master: 'READY' | 'UNAVAILABLE'
  latest_market: 'READY' | 'STALE' | 'UNAVAILABLE'
  historical_ohlcv: 'READY' | 'STALE' | 'UNAVAILABLE'
  index_summary: 'READY' | 'STALE' | 'UNAVAILABLE'
  foreign_flow: 'READY' | 'STALE' | 'UNAVAILABLE'
  broker_market_flow: 'READY' | 'STALE' | 'UNAVAILABLE'
  news: 'READY' | 'UNAVAILABLE'
  announcements: 'READY' | 'UNAVAILABLE'
  latestTradingDate: string | null
}> {
  // Check security master
  const securityMaster = await fetchSecurityMaster()

  // Check market overview (includes indices)
  const overview = await fetchMarketOverview()

  // Check news
  const news = await fetchNews(1, 1)

  // Check announcements
  const announcements = await fetchAnnouncements('', 1, 1)

  // Check historical data via market-api
  let latestTradingDate: string | null = null
  try {
    const readyResponse = await fetchUpstream('/ready') as { capabilities?: Record<string, { latestAvailableDate?: string | null }> }
    if (readyResponse.capabilities?.historical_ohlcv?.latestAvailableDate) {
      latestTradingDate = readyResponse.capabilities.historical_ohlcv.latestAvailableDate
    }
  } catch {
    // Market-api may not be available
  }

  return {
    security_master: securityMaster.data.length > 0 ? 'READY' : 'UNAVAILABLE',
    latest_market: overview.meta.freshness === 'LIVE' || overview.meta.freshness === 'EOD' ? 'READY' : 'STALE',
    historical_ohlcv: latestTradingDate ? 'READY' : 'UNAVAILABLE',
    index_summary: overview.meta.freshness === 'LIVE' || overview.meta.freshness === 'EOD' ? 'READY' : 'UNAVAILABLE',
    foreign_flow: overview.meta.freshness === 'LIVE' || overview.meta.freshness === 'EOD' ? 'READY' : 'UNAVAILABLE',
    broker_market_flow: 'UNAVAILABLE', // Market-wide only, not per-security
    news: news.meta.freshness === 'LIVE' || news.meta.freshness === 'EOD' ? 'READY' : 'UNAVAILABLE',
    announcements: announcements.meta.freshness === 'LIVE' || announcements.meta.freshness === 'EOD' ? 'READY' : 'UNAVAILABLE',
    latestTradingDate,
  }
}
