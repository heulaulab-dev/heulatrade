/**
 * Direct/Snapshot Providers for market-api data.
 *
 * These providers query the FastAPI market-api (which wraps idx-bei scrapers).
 * Next.js MUST NEVER scrape IDX directly - it only queries the market-api.
 *
 * Architecture:
 *   Next.js → market-api (FastAPI) → idx-bei Python → IDX
 *
 * Caching: In-memory TTL cache
 * Freshness: Explicit source, fetchedAt, dataAsOf, freshness
 */

import { z } from 'zod'
import { type MarketMeta } from '../contracts'

const MARKET_API_BASE = process.env.MARKET_API_URL?.replace(/\/$/, '') || 'http://127.0.0.1:8000'

// Cache configuration
const CACHE_TTL = {
  securities: 3600_000,      // 1 hour - company directory changes rarely
  companyProfile: 86400_000, // 24 hours - company details are stable
  news: 900_000,             // 15 minutes - news updates frequently
  announcements: 900_000,    // 15 minutes - announcements update frequently
  stockSummary: 300_000,     // 5 minutes - market data
  indexSummary: 300_000,     // 5 minutes - market data
}

// In-memory cache
const cache = new Map<string, { data: unknown; timestamp: number }>()

function getFromCache<T>(key: string, ttl: number): T | null {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() - entry.timestamp > ttl) {
    cache.delete(key)
    return null
  }
  return entry.data as T
}

function setInCache(key: string, data: unknown): void {
  cache.set(key, { data, timestamp: Date.now() })
}

// Market-API fetcher with error handling
async function fetchMarketApi<T>(path: string): Promise<T> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10_000)

  try {
    const response = await fetch(`${MARKET_API_BASE}${path}`, {
      signal: controller.signal,
      cache: 'no-store',
    })

    if (!response.ok) {
      throw new Error(`Market-API returned ${response.status}`)
    }

    return await response.json() as T
  } finally {
    clearTimeout(timeout)
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECURITY MASTER PROVIDER
// ═══════════════════════════════════════════════════════════════════════════════

const SecurityMasterItem = z.object({
  symbol: z.string(),
  companyName: z.string(),
  sector: z.string().nullable().optional(),
  subsector: z.string().nullable().optional(),
  board: z.string().nullable().optional(),
})

const SecurityMasterResponse = z.object({
  data: z.array(SecurityMasterItem),
  meta: z.object({
    source: z.string(),
    fetchedAt: z.string(),
    dataAsOf: z.string().nullable(),
    freshness: z.string(),
  }),
})

export type SecurityMasterItem = z.infer<typeof SecurityMasterItem>

export async function fetchSecurityMaster(q = ''): Promise<{
  data: SecurityMasterItem[]
  meta: MarketMeta
}> {
  const cacheKey = `security-master:${q}`
  const cached = getFromCache<{ data: SecurityMasterItem[]; meta: MarketMeta }>(cacheKey, CACHE_TTL.securities)
  if (cached) return cached

  try {
    const queryParam = q ? `?q=${encodeURIComponent(q)}` : ''
    const response = await fetchMarketApi<unknown>(`/v1/securities${queryParam}`)
    const parsed = SecurityMasterResponse.parse(response)

    const result = {
      data: parsed.data.map(item => ({
        symbol: item.symbol,
        companyName: item.companyName,
        sector: item.sector ?? null,
        subsector: item.subsector ?? null,
        board: item.board ?? null,
      })),
      meta: {
        source: parsed.meta.source,
        fetchedAt: parsed.meta.fetchedAt,
        dataAsOf: parsed.meta.dataAsOf,
        freshness: parsed.meta.freshness as MarketMeta['freshness'],
      },
    }

    setInCache(cacheKey, result)
    return result
  } catch (error) {
    console.error('Failed to fetch security master:', error)
    return {
      data: [],
      meta: {
        source: 'market-api',
        fetchedAt: new Date().toISOString(),
        dataAsOf: null,
        freshness: 'UNAVAILABLE',
      },
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPANY PROFILE PROVIDER
// ═══════════════════════════════════════════════════════════════════════════════

const CompanyProfileResponse = z.object({
  data: z.object({
    symbol: z.string(),
    companyName: z.string().nullable().optional(),
    website: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    directors: z.array(z.record(z.unknown())).optional(),
    commissioners: z.array(z.record(z.unknown())).optional(),
    shareholders: z.array(z.record(z.unknown())).optional(),
    subsidiaries: z.array(z.record(z.unknown())).optional(),
  }),
  meta: z.object({
    source: z.string(),
    fetchedAt: z.string(),
    dataAsOf: z.string().nullable(),
    freshness: z.string(),
  }),
})

export type CompanyProfile = {
  symbol: string
  companyName: string | null
  website: string | null
  description: string | null
  directors: Record<string, unknown>[]
  commissioners: Record<string, unknown>[]
  shareholders: Record<string, unknown>[]
  subsidiaries: Record<string, unknown>[]
}

export async function fetchCompanyProfile(symbol: string): Promise<{
  data: CompanyProfile
  meta: MarketMeta
}> {
  const cacheKey = `profile:${symbol}`
  const cached = getFromCache<{ data: CompanyProfile; meta: MarketMeta }>(cacheKey, CACHE_TTL.companyProfile)
  if (cached) return cached

  try {
    const response = await fetchMarketApi<unknown>(`/v1/stocks/${encodeURIComponent(symbol)}/profile`)
    const parsed = CompanyProfileResponse.parse(response)

    const result = {
      data: {
        symbol: parsed.data.symbol,
        companyName: parsed.data.companyName ?? null,
        website: parsed.data.website ?? null,
        description: parsed.data.description ?? null,
        directors: parsed.data.directors ?? [],
        commissioners: parsed.data.commissioners ?? [],
        shareholders: parsed.data.shareholders ?? [],
        subsidiaries: parsed.data.subsidiaries ?? [],
      },
      meta: {
        source: parsed.meta.source,
        fetchedAt: parsed.meta.fetchedAt,
        dataAsOf: parsed.meta.dataAsOf,
        freshness: parsed.meta.freshness as MarketMeta['freshness'],
      },
    }

    setInCache(cacheKey, result)
    return result
  } catch (error) {
    console.error(`Failed to fetch company profile for ${symbol}:`, error)
    return {
      data: {
        symbol: symbol.toUpperCase(),
        companyName: null,
        website: null,
        description: null,
        directors: [],
        commissioners: [],
        shareholders: [],
        subsidiaries: [],
      },
      meta: {
        source: 'market-api',
        fetchedAt: new Date().toISOString(),
        dataAsOf: null,
        freshness: 'UNAVAILABLE',
      },
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// NEWS PROVIDER
// ═══════════════════════════════════════════════════════════════════════════════

const NewsItem = z.object({
  date: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  summary: z.string().nullable().optional(),
  url: z.string().nullable().optional(),
})

const NewsResponse = z.object({
  data: z.array(z.record(z.unknown())),
  meta: z.object({
    source: z.string(),
    fetchedAt: z.string(),
    dataAsOf: z.string().nullable(),
    freshness: z.string(),
  }),
})

export type NewsItem = z.infer<typeof NewsItem>

export async function fetchNews(pageNumber = 1, pageSize = 20): Promise<{
  data: NewsItem[]
  meta: MarketMeta & { page: number; totalPages: number }
}> {
  const cacheKey = `news:${pageNumber}:${pageSize}`
  const cached = getFromCache<{ data: NewsItem[]; meta: MarketMeta & { page: number; totalPages: number } }>(cacheKey, CACHE_TTL.news)
  if (cached) return cached

  try {
    const response = await fetchMarketApi<unknown>(`/v1/news?page=${pageNumber}&page_size=${pageSize}`)
    const parsed = NewsResponse.parse(response)

    const result = {
      data: parsed.data.map(item => ({
        date: item.date as string | null,
        title: item.title as string | null,
        summary: item.summary as string | null,
        url: item.url as string | null,
      })),
      meta: {
        source: parsed.meta.source,
        fetchedAt: parsed.meta.fetchedAt,
        dataAsOf: parsed.meta.dataAsOf,
        freshness: parsed.meta.freshness as MarketMeta['freshness'],
        page: pageNumber,
        totalPages: Math.ceil((parsed.data.length || 0) / pageSize),
      },
    }

    setInCache(cacheKey, result)
    return result
  } catch (error) {
    console.error('Failed to fetch news:', error)
    return {
      data: [],
      meta: {
        source: 'market-api',
        fetchedAt: new Date().toISOString(),
        dataAsOf: null,
        freshness: 'UNAVAILABLE',
        page: pageNumber,
        totalPages: 0,
      },
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANNOUNCEMENTS PROVIDER
// ═══════════════════════════════════════════════════════════════════════════════

const AnnouncementItem = z.object({
  date: z.string().nullable().optional(),
  symbol: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  documentUrl: z.string().nullable().optional(),
})

const AnnouncementResponse = z.object({
  data: z.array(z.record(z.unknown())),
  meta: z.object({
    source: z.string(),
    fetchedAt: z.string(),
    dataAsOf: z.string().nullable(),
    freshness: z.string(),
  }),
})

export type AnnouncementItem = z.infer<typeof AnnouncementItem>

export async function fetchAnnouncements(keywords = '', pageNumber = 1, pageSize = 20): Promise<{
  data: AnnouncementItem[]
  meta: MarketMeta & { page: number; totalPages: number }
}> {
  const cacheKey = `announcements:${keywords}:${pageNumber}:${pageSize}`
  const cached = getFromCache<{ data: AnnouncementItem[]; meta: MarketMeta & { page: number; totalPages: number } }>(cacheKey, CACHE_TTL.announcements)
  if (cached) return cached

  try {
    const params = new URLSearchParams()
    if (keywords) params.set('keywords', keywords)
    params.set('page', String(pageNumber))
    params.set('page_size', String(pageSize))

    const response = await fetchMarketApi<unknown>(`/v1/announcements?${params.toString()}`)
    const parsed = AnnouncementResponse.parse(response)

    const result = {
      data: parsed.data.map(item => ({
        date: item.date as string | null,
        symbol: item.symbol as string | null,
        title: item.title as string | null,
        documentUrl: item.documentUrl as string | null,
      })),
      meta: {
        source: parsed.meta.source,
        fetchedAt: parsed.meta.fetchedAt,
        dataAsOf: parsed.meta.dataAsOf,
        freshness: parsed.meta.freshness as MarketMeta['freshness'],
        page: pageNumber,
        totalPages: Math.ceil((parsed.data.length || 0) / pageSize),
      },
    }

    setInCache(cacheKey, result)
    return result
  } catch (error) {
    console.error('Failed to fetch announcements:', error)
    return {
      data: [],
      meta: {
        source: 'market-api',
        fetchedAt: new Date().toISOString(),
        dataAsOf: null,
        freshness: 'UNAVAILABLE',
        page: pageNumber,
        totalPages: 0,
      },
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// STOCK SUMMARY PROVIDER (Latest)
// ═══════════════════════════════════════════════════════════════════════════════

export async function fetchStockSummary(symbol: string, limit = 1600): Promise<{
  data: { quote: Record<string, unknown>; candles: Record<string, unknown>[] }
  meta: MarketMeta
}> {
  const cacheKey = `stock-summary:${symbol}:${limit}`
  const cached = getFromCache<{ data: { quote: Record<string, unknown>; candles: Record<string, unknown>[] }; meta: MarketMeta }>(cacheKey, CACHE_TTL.stockSummary)
  if (cached) return cached

  try {
    const response = await fetchMarketApi<{ data: { quote: Record<string, unknown>; candles: Record<string, unknown>[] }; meta: { source: string; fetchedAt: string; dataAsOf: string | null; freshness: string } }>(`/v1/stocks/${encodeURIComponent(symbol)}?limit=${limit}`)

    const result = {
      data: {
        quote: response.data.quote,
        candles: response.data.candles,
      },
      meta: {
        source: response.meta.source,
        fetchedAt: response.meta.fetchedAt,
        dataAsOf: response.meta.dataAsOf,
        freshness: response.meta.freshness as MarketMeta['freshness'],
      },
    }

    setInCache(cacheKey, result)
    return result
  } catch (error) {
    console.error(`Failed to fetch stock summary for ${symbol}:`, error)
    return {
      data: { quote: {}, candles: [] },
      meta: {
        source: 'market-api',
        fetchedAt: new Date().toISOString(),
        dataAsOf: null,
        freshness: 'UNAVAILABLE',
      },
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MARKET OVERVIEW PROVIDER
// ═══════════════════════════════════════════════════════════════════════════════

export async function fetchMarketOverview(): Promise<{
  data: Record<string, unknown>
  meta: MarketMeta
}> {
  const cacheKey = 'market-overview'
  const cached = getFromCache<{ data: Record<string, unknown>; meta: MarketMeta }>(cacheKey, CACHE_TTL.indexSummary)
  if (cached) return cached

  try {
    const response = await fetchMarketApi<{ data: Record<string, unknown>; meta: { source: string; fetchedAt: string; dataAsOf: string | null; freshness: string } }>('/v1/market')

    const result = {
      data: response.data,
      meta: {
        source: response.meta.source,
        fetchedAt: response.meta.fetchedAt,
        dataAsOf: response.meta.dataAsOf,
        freshness: response.meta.freshness as MarketMeta['freshness'],
      },
    }

    setInCache(cacheKey, result)
    return result
  } catch (error) {
    console.error('Failed to fetch market overview:', error)
    return {
      data: { indices: [], breadth: {}, movers: [] },
      meta: {
        source: 'market-api',
        fetchedAt: new Date().toISOString(),
        dataAsOf: null,
        freshness: 'UNAVAILABLE',
      },
    }
  }
}
