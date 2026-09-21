import 'server-only'
import { z } from 'zod'
import { ActionSchema, CandleSchema, FundamentalsSchema, MarketOverviewSchema, MetaSchema, ProfileSchema, QuoteSchema, ScreenRequestSchema, ScreenResponseSchema, SecuritySchema, SignalsSchema, SymbolSchema } from './contracts'

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

const StockResponse = z.object({ data: z.object({ quote: QuoteSchema, candles: z.array(CandleSchema) }), meta: MetaSchema })
const SecuritiesResponse = z.object({ data: z.array(SecuritySchema), meta: MetaSchema })
const SignalsResponse = z.object({ data: SignalsSchema, meta: MetaSchema })
const OverviewResponse = z.object({ data: MarketOverviewSchema, meta: MetaSchema })
const FundamentalsResponse = z.object({ data: FundamentalsSchema, meta: MetaSchema })
const ProfileResponse = z.object({ data: ProfileSchema, meta: MetaSchema })
const ActionsResponse = z.object({ data: ActionSchema, meta: MetaSchema })

export const getStock = (symbol: string) => validated(`/v1/stocks/${encodeURIComponent(SymbolSchema.parse(symbol))}`, StockResponse)
export const getSecurities = (q = '') => validated(`/v1/securities?q=${encodeURIComponent(q)}`, SecuritiesResponse)
export const getSignals = () => validated('/v1/signals', SignalsResponse)
export const getOverview = () => validated('/v1/market', OverviewResponse)
export const getFundamentals = (symbol: string) => validated(`/v1/stocks/${encodeURIComponent(SymbolSchema.parse(symbol))}/fundamentals`, FundamentalsResponse)
export const getProfile = (symbol: string) => validated(`/v1/stocks/${encodeURIComponent(SymbolSchema.parse(symbol))}/profile`, ProfileResponse)
export const getActions = (symbol: string) => validated(`/v1/stocks/${encodeURIComponent(SymbolSchema.parse(symbol))}/actions`, ActionsResponse)
export async function runScreener(input: unknown) {
  const request = ScreenRequestSchema.parse(input)
  try { return ScreenResponseSchema.parse(await postUpstream('/v1/screener', request)) }
  catch (error) {
    if (error instanceof MarketError) throw error
    throw new MarketError('SCHEMA_DRIFT', 'Screener response format changed')
  }
}
