import { z } from 'zod'
import { ActionSchema, CandleSchema, FundamentalsSchema, MarketOverviewSchema, MetaSchema, ProfileSchema, QuoteSchema, ScreenResponseSchema, SecuritySchema, SignalsSchema, type MarketResponse, type ScreenCondition } from '@/lib/market/contracts'

const StockResponse = z.object({ data: z.object({ quote: QuoteSchema, candles: z.array(CandleSchema) }), meta: MetaSchema })
const SecuritiesResponse = z.object({ data: z.array(SecuritySchema), meta: MetaSchema })
const SignalsResponse = z.object({ data: SignalsSchema, meta: MetaSchema })
const OverviewResponse = z.object({ data: MarketOverviewSchema, meta: MetaSchema })
const FundamentalsResponse = z.object({ data: FundamentalsSchema, meta: MetaSchema })
const ProfileResponse = z.object({ data: ProfileSchema, meta: MetaSchema })
const ActionsResponse = z.object({ data: ActionSchema, meta: MetaSchema })
async function getJson(url: string): Promise<unknown> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(response.status === 503 ? 'Market service unavailable' : `Market request failed (${response.status})`)
  return response.json()
}
export async function stockQuery(symbol: string) { return StockResponse.parse(await getJson(`/api/stocks/${encodeURIComponent(symbol)}`)) }
export async function securitiesQuery(q = ''): Promise<MarketResponse<z.infer<typeof SecuritySchema>[]>> {
  return SecuritiesResponse.parse(await getJson(`/api/securities/search?q=${encodeURIComponent(q)}`))
}
export async function signalsQuery() { return SignalsResponse.parse(await getJson('/api/signals')) }
export async function overviewQuery() { return OverviewResponse.parse(await getJson('/api/market')) }
export async function fundamentalsQuery(symbol: string) { return FundamentalsResponse.parse(await getJson(`/api/stocks/${encodeURIComponent(symbol)}/fundamentals`)) }
export async function profileQuery(symbol: string) { return ProfileResponse.parse(await getJson(`/api/stocks/${encodeURIComponent(symbol)}/profile`)) }
export async function actionsQuery(symbol: string) { return ActionsResponse.parse(await getJson(`/api/stocks/${encodeURIComponent(symbol)}/actions`)) }
export async function screenerQuery(conditions: ScreenCondition[]) {
  const response = await fetch('/api/screener', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ conditions, limit: 1000 }) })
  if (!response.ok) throw new Error(response.status === 503 ? 'Market service unavailable' : `Screener request failed (${response.status})`)
  return ScreenResponseSchema.parse(await response.json())
}
