import { describe, expect, it } from 'vitest'
import { calculatePortfolio } from '@/lib/portfolio'

describe('transaction derived portfolio', () => {
  it('uses cost basis for realized P/L and never needs fabricated market prices', () => {
    const result = calculatePortfolio([
      { symbol: 'BBCA', transaction_type: 'BUY', transaction_date: '2026-01-01', quantity: 100, price: 9000, fees: 1000, cash_amount: null },
      { symbol: 'BBCA', transaction_type: 'SELL', transaction_date: '2026-02-01', quantity: 40, price: 9500, fees: 1000, cash_amount: null },
    ])
    expect(result.positions[0].quantity).toBe(60)
    expect(result.positions[0].costBasis).toBe(540600)
    expect(result.realizedPnL).toBe(18600)
  })
  it('rejects a sale larger than the position', () => {
    expect(() => calculatePortfolio([{ symbol: 'BBCA', transaction_type: 'SELL', transaction_date: '2026-01-01', quantity: 1, price: 9000, fees: 0, cash_amount: null }])).toThrow('exceeds')
  })
})
