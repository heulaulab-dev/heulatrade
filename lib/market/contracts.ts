import { z } from 'zod'

export const SymbolSchema = z.string().trim().toUpperCase().regex(/^[A-Z0-9]{1,12}$/)
export const FreshnessSchema = z.enum(['LIVE', 'DELAYED', 'EOD', 'STALE', 'UNAVAILABLE'])
export const MetaSchema = z.object({
  source: z.string(),
  fetchedAt: z.string().datetime(),
  dataAsOf: z.string().nullable(),
  freshness: FreshnessSchema,
})
export type MarketMeta = z.infer<typeof MetaSchema>
export type MarketResponse<T> = { data: T; meta: MarketMeta }

export const SecuritySchema = z.object({
  symbol: SymbolSchema,
  companyName: z.string(),
  sector: z.string().nullable(),
  subsector: z.string().nullable(),
  board: z.string().nullable(),
})
export type Security = z.infer<typeof SecuritySchema>

export const QuoteSchema = z.object({
  symbol: SymbolSchema,
  timestamp: z.string(),
  open: z.number().finite().nullable(), high: z.number().finite().nullable(),
  low: z.number().finite().nullable(), close: z.number().finite().nullable(),
  previousClose: z.number().finite().nullable(), change: z.number().finite().nullable(),
  changePercent: z.number().finite().nullable(), volume: z.number().finite().nullable(),
  value: z.number().finite().nullable(), frequency: z.number().finite().nullable(),
})
export type Quote = z.infer<typeof QuoteSchema>

export const CandleSchema = z.object({
  time: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  open: z.number().finite().nullable(), high: z.number().finite().nullable(),
  low: z.number().finite().nullable(), close: z.number().finite(),
  volume: z.number().finite().nullable(),
  foreignBuy: z.number().finite().nullable(), foreignSell: z.number().finite().nullable(),
})
export type Candle = z.infer<typeof CandleSchema>

export const ForeignSignalSchema = z.object({
  symbol: SymbolSchema, close: z.number().finite().nullable(), sessions: z.number().int().nonnegative(),
  netForeignMillionShares: z.number().finite().nullable(), percentFloat: z.number().finite().nullable(),
  averageValueBillionIdr: z.number().finite().nullable(), signal: z.enum(['accumulate', 'distribute']),
})
export const SignalsSchema = z.object({ tradingDate: z.string(), foreignFlow: z.array(ForeignSignalSchema) })
export const MarketOverviewSchema = z.object({
  indices: z.array(z.object({ code: z.string().nullable(), name: z.string().nullable(), close: z.number().nullable(), previousClose: z.number().nullable(), changePercent: z.number().nullable() })),
  breadth: z.object({ advancers: z.number(), decliners: z.number(), unchanged: z.number(), value: z.number(), volume: z.number(), frequency: z.number() }),
  movers: z.array(z.object({ symbol: z.string().nullable(), name: z.string().nullable(), close: z.number().nullable(), changePercent: z.number().nullable(), volume: z.number().nullable(), value: z.number().nullable(), frequency: z.number().nullable() })),
})
export const FundamentalsSchema = z.array(z.object({ periodDate: z.string().nullable(), periodType: z.string(), metrics: z.record(z.number().nullable()) }))
export const ProfileSchema = z.object({ symbol: SymbolSchema, companyName: z.string().nullable(), website: z.string().nullable(), description: z.string().nullable(), directors: z.array(z.record(z.unknown())), commissioners: z.array(z.record(z.unknown())), shareholders: z.array(z.record(z.unknown())), subsidiaries: z.array(z.record(z.unknown())) })
export const ActionSchema = z.array(z.object({ date: z.string().nullable(), type: z.string().nullable(), description: z.string().nullable(), documentUrl: z.string().nullable() }))

export const ScreenFieldSchema = z.enum(['price', 'volume', 'value', 'frequency', 'foreignNetShares', 'marketCap', 'per', 'pbv', 'roe', 'roa', 'eps', 'der', 'dividendYield', 'change1D'])
export const ScreenConditionSchema = z.object({
  field: ScreenFieldSchema,
  operator: z.enum(['GT', 'GTE', 'LT', 'LTE', 'EQ']),
  value: z.number().finite(),
  connective: z.enum(['AND', 'OR']).default('AND'),
})
export const ScreenRequestSchema = z.object({ conditions: z.array(ScreenConditionSchema).max(20), limit: z.number().int().min(1).max(1000).default(500) })
export type ScreenCondition = z.infer<typeof ScreenConditionSchema>
export const ScreenRowSchema = z.object({ symbol: SymbolSchema, name: z.string().nullable() }).catchall(z.number().finite().nullable())
export const ScreenResponseSchema = z.object({ data: z.object({ rows: z.array(ScreenRowSchema), total: z.number().int().nonnegative(), supportedFields: z.array(ScreenFieldSchema) }), meta: MetaSchema })

export type PanelData = Quote | Candle[] | Security[] | Record<string, unknown>

export function unavailable<T>(data: T, source = 'idx-bei'): MarketResponse<T> {
  return { data, meta: { source, fetchedAt: new Date().toISOString(), dataAsOf: null, freshness: 'UNAVAILABLE' } }
}
