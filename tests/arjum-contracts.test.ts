import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import {
  analysisResponseSchema,
  brokerAccumulationResponseSchema,
  brokerSummaryResponseSchema,
  doneDetailsResponseSchema,
  financialStatementsResponseSchema,
  healthResponseSchema,
  historyResponseSchema,
  insidersResponseSchema,
  marketCapResponseSchema,
  screenerResponseSchema,
  searchResponseSchema,
  seasonalityResponseSchema,
} from '@/lib/market/arjum/schemas'
import { buildProviderUrl } from '@/lib/market/arjum/queries'
import {
  buildFinancialRows,
  normalizeBrokerSummary,
  normalizeDoneDetails,
  normalizeSeasonality,
} from '@/lib/market/arjum/normalizers'
import { closePolicy, normalizeRunningTradeMessage } from '@/lib/market/arjum/websocket'

function fixture(name: string): unknown {
  return JSON.parse(readFileSync(new URL(`./fixtures/arjum/${name}.json`, import.meta.url), 'utf8'))
}

describe('Arjum saved response contracts', () => {
  const cases = [
    ['search', searchResponseSchema],
    ['screener', screenerResponseSchema],
    ['analysis', analysisResponseSchema],
    ['broker-summary', brokerSummaryResponseSchema],
    ['broker-accumulation', brokerAccumulationResponseSchema],
    ['history', historyResponseSchema],
    ['seasonal', seasonalityResponseSchema],
    ['market-cap', marketCapResponseSchema],
    ['financial-statements', financialStatementsResponseSchema],
    ['insiders', insidersResponseSchema],
    ['done-details', doneDetailsResponseSchema],
    ['health', healthResponseSchema],
  ] as const

  test.each(cases)('%s parses its saved response', (name, schema) => {
    expect(schema.safeParse(fixture(name)).success).toBe(true)
  })

  test('rejects malformed provider fields', () => {
    const value = fixture('history') as { rows: Array<{ close: unknown }> }
    value.rows[0].close = '6300'
    expect(historyResponseSchema.safeParse(value).success).toBe(false)
  })
})

test('provider URL builder encodes paths and omits absent query values', () => {
  expect(buildProviderUrl('https://stock.arjum.com/', '/api/history/BB CA', {
    frame: 'weekly', limit: 120, year: undefined, brokers: [],
  })).toBe('https://stock.arjum.com/api/history/BB%20CA?frame=weekly&limit=120')
})

test('financial rows retain hierarchy and align periods', () => {
  const parsed = financialStatementsResponseSchema.parse(fixture('financial-statements'))
  const rows = buildFinancialRows(parsed.items)
  expect(rows.length).toBeGreaterThan(1)
  expect(rows.some((row) => row.depth > 0)).toBe(true)
  expect(rows.every((row) => row.values.length === parsed.items.length)).toBe(true)
  expect(rows.find((row) => row.key.endsWith('laba_rugi'))?.values.some((value) => typeof value === 'number')).toBe(true)
})

test('broker normalization computes sell and frequency nets and sorts by net value', () => {
  const rows = normalizeBrokerSummary(brokerSummaryResponseSchema.parse(fixture('broker-summary'))).brokers
  expect(rows[0].netValue).toBeGreaterThanOrEqual(rows[1].netValue)
  expect(rows[0].netFrequency).toBe(rows[0].buyFrequency - rows[0].sellFrequency)
})

test('seasonality normalization creates readable year rows and summary columns', () => {
  const matrix = normalizeSeasonality(seasonalityResponseSchema.parse(fixture('seasonal')))
  expect(matrix.months).toHaveLength(12)
  expect(matrix.rows[0].values).toHaveLength(12)
  expect(matrix.summary[0]).toMatchObject({ month: 'Jan' })
})

test('done details uses provider action as aggressor and numeric raw fields', () => {
  const normalized = normalizeDoneDetails(doneDetailsResponseSchema.parse(fixture('done-details')))
  expect(normalized.rows[0]).toMatchObject({ aggressor: 'BUY', price: 6300 })
  expect(typeof normalized.rows[0].value).toBe('number')
})

describe('running trade normalization', () => {
  test('normalizes snapshot, trade, and top5 messages', () => {
    expect(normalizeRunningTradeMessage({ type: 'snapshot', market_status: 'OPEN', session_status: 'SESSION_1', data: [{ t: '09:00:00', c: 'BBCA', a: 'BUY', p: 6300, l: 2, v: 1_260_000, pc: 25, tn: 10 }] })).toMatchObject({ type: 'snapshot', trades: [{ symbol: 'BBCA', lots: 2 }] })
    expect(normalizeRunningTradeMessage({ type: 'trade', t: '09:00:01', c: 'BBRI', a: 'SELL', p: 3310, l: 5, v: 1_655_000, pc: -10, tn: 11 })).toMatchObject({ type: 'trade', trade: { symbol: 'BBRI', action: 'SELL' } })
    expect(normalizeRunningTradeMessage({ type: 'top5', data: [{ c: 'BMRI', v: 500_000_000, tn: 200 }] })).toMatchObject({ type: 'top5', rows: [{ symbol: 'BMRI' }] })
  })

  test('rejects malformed messages and handles provider close codes', () => {
    expect(() => normalizeRunningTradeMessage({ type: 'trade', c: 'BBCA' })).toThrow()
    expect(closePolicy(4401)).toMatchObject({ reconnect: false, state: 'OFFLINE' })
    expect(closePolicy(4403)).toMatchObject({ reconnect: false, state: 'OFFLINE' })
    expect(closePolicy(4408).minimumDelayMs).toBeGreaterThanOrEqual(60_000)
    expect(closePolicy(1006)).toMatchObject({ reconnect: true, state: 'RECONNECTING' })
  })
})
