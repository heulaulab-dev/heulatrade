import { describe, expect, it } from 'vitest'
import { observedMetric, triggered } from '@/lib/alerts/evaluate'
import type { Candle, Quote } from '@/lib/market/contracts'

const quote: Quote = { symbol: 'BBCA', timestamp: '2026-09-21', open: null, high: null, low: null, close: 9100, previousClose: 9000, change: 100, changePercent: 100 / 9000, volume: 100, value: null, frequency: null }
const latest: Candle = { time: '2026-09-21', open: null, high: null, low: null, close: 9100, volume: 100, foreignBuy: 50, foreignSell: 30 }

describe('EOD alert evaluation', () => {
  it('uses percentage points for daily change and shares for foreign net', () => {
    expect(observedMetric('DAILY_CHANGE', quote, [latest])).toBeCloseTo(1.1111, 3)
    expect(observedMetric('FOREIGN_NET', quote, [latest])).toBe(20)
    expect(triggered({ metric: 'DAILY_CHANGE', operator: 'GT', threshold: 1 }, 1.1111)).toBe(true)
  })
  it('requires all 20 preceding sessions for a volume ratio', () => {
    expect(observedMetric('VOLUME_RATIO_20D', quote, [latest])).toBeNull()
    const previous = Array.from({ length: 20 }, (_, index): Candle => ({ ...latest, time: `2026-08-${String(index + 1).padStart(2, '0')}`, volume: 50 }))
    expect(observedMetric('VOLUME_RATIO_20D', quote, [...previous, latest])).toBe(2)
    expect(observedMetric('VOLUME_RATIO_20D', quote, [...previous.slice(1), { ...previous[0], volume: null }, latest])).toBeNull()
  })
  it('never treats missing data as zero', () => {
    expect(observedMetric('FOREIGN_NET', quote, [{ ...latest, foreignBuy: null }])).toBeNull()
    expect(triggered({ metric: 'PRICE', operator: 'LT', threshold: 1 }, null)).toBe(false)
    expect(triggered({ metric: 'PRICE', operator: 'GTE', threshold: 0 }, 0)).toBe(true)
  })
})
