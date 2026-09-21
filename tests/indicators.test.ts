import { describe, expect, test } from 'vitest'
import { historyQueryKey, HISTORY_DEFAULTS } from '@/lib/api/market-client'
import { calculateMacd, calculateSimpleMovingAverage } from '@/lib/market/indicators'

describe('shared history configuration', () => {
  test('uses one canonical default key for all matching consumers', () => {
    expect(HISTORY_DEFAULTS).toEqual({ frame: 'daily', limit: 120 })
    expect(historyQueryKey('bbca', HISTORY_DEFAULTS.frame, HISTORY_DEFAULTS.limit)).toEqual([
      'arjum', 'history', 'BBCA', 'daily', 120,
    ])
  })
})

describe('local history indicators', () => {
  const rows = Array.from({ length: 60 }, (_, index) => ({ time: `2026-01-${String(index + 1).padStart(2, '0')}`, close: index + 1 }))

  test('calculates simple moving averages only after enough finite samples', () => {
    const ma5 = calculateSimpleMovingAverage(rows, 5)
    expect(ma5[0]).toEqual({ time: rows[4].time, value: 3 })
    expect(ma5.every((point) => Number.isFinite(point.value))).toBe(true)
    expect(calculateSimpleMovingAverage(rows.slice(0, 4), 5)).toEqual([])
  })

  test('calculates finite MACD values and omits insufficient samples', () => {
    const macd = calculateMacd(rows)
    expect(macd.length).toBeGreaterThan(0)
    expect(macd.every((point) => [point.macd, point.signal, point.histogram].every(Number.isFinite))).toBe(true)
    expect(calculateMacd(rows.slice(0, 20))).toEqual([])
  })
})
