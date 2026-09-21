import type { Candle, Quote } from '@/lib/market/contracts'

export type AlertRule = { metric: 'PRICE' | 'DAILY_CHANGE' | 'FOREIGN_NET' | 'VOLUME' | 'VOLUME_RATIO_20D'; operator: 'GT' | 'GTE' | 'LT' | 'LTE'; threshold: number }

export function observedMetric(metric: AlertRule['metric'], quote: Quote, candles: Candle[]): number | null {
  if (metric === 'PRICE') return quote.close
  if (metric === 'DAILY_CHANGE') return quote.changePercent === null ? null : quote.changePercent * 100
  if (metric === 'VOLUME') return quote.volume
  const latest = candles.at(-1)
  if (!latest || latest.time !== quote.timestamp) return null
  if (metric === 'FOREIGN_NET') return latest.foreignBuy === null || latest.foreignSell === null ? null : latest.foreignBuy - latest.foreignSell
  if (latest.volume === null || candles.length < 21) return null
  const history = candles.slice(-21, -1).map((row) => row.volume)
  if (history.some((volume) => volume === null)) return null
  const average = (history as number[]).reduce((sum, volume) => sum + volume, 0) / 20
  return average > 0 ? latest.volume / average : null
}

export function triggered(rule: AlertRule, value: number | null): boolean {
  if (value === null || !Number.isFinite(value) || !Number.isFinite(rule.threshold)) return false
  switch (rule.operator) {
    case 'GT': return value > rule.threshold
    case 'GTE': return value >= rule.threshold
    case 'LT': return value < rule.threshold
    case 'LTE': return value <= rule.threshold
  }
}
