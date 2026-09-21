import { describe, expect, it } from 'vitest'
import { CandleSchema, QuoteSchema, ScreenRequestSchema, ScreenResponseSchema } from '@/lib/market/contracts'

const meta = { source: 'idx-bei/stock_summary.parquet', fetchedAt: '2026-09-21T00:00:00Z', dataAsOf: '2026-09-21', freshness: 'EOD' }

describe('normalized market contract', () => {
  it('preserves null independently from actual zero', () => {
    const quote = QuoteSchema.parse({ symbol: 'BBCA', timestamp: '2026-09-21', open: null, high: null, low: null, close: 0, previousClose: 0, change: 0, changePercent: null, volume: 0, value: null, frequency: null, foreignBuy: null, foreignSell: null })
    expect(quote.open).toBeNull()
    expect(quote.close).toBe(0)
    expect(quote.volume).toBe(0)
    const candle = CandleSchema.parse({ time: '2026-09-21', open: null, high: null, low: null, close: 0, volume: null, foreignBuy: null, foreignSell: null })
    expect(candle.high).toBeNull()
  })
  it('rejects schema drift instead of silently filling missing financial values', () => {
    expect(() => QuoteSchema.parse({ symbol: 'BBCA', close: 9000 })).toThrow()
    expect(() => CandleSchema.parse({ time: '2026-09-21', close: Number.NaN })).toThrow()
  })
  it('limits screener fields and rejects fabricated rows', () => {
    expect(ScreenRequestSchema.safeParse({ conditions: [{ field: 'brokerNet', operator: 'GT', value: 0 }] }).success).toBe(false)
    expect(ScreenRequestSchema.safeParse({ conditions: [{ field: 'roe', operator: 'GT', value: 15 }] }).success).toBe(true)
    expect(ScreenResponseSchema.safeParse({ data: { rows: [{ symbol: 'BBCA', name: 'Bank', roe: null }], total: 1, supportedFields: ['roe'] }, meta }).success).toBe(true)
    expect(ScreenResponseSchema.safeParse({ data: { rows: [{ symbol: 'BBCA', name: 'Bank', roe: 'missing' }], total: 1, supportedFields: ['roe'] }, meta }).success).toBe(false)
  })
})
