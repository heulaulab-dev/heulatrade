import type { z } from 'zod'
import type { FinancialRow } from './contracts'
import type { financialStatementsResponseSchema, brokerSummaryResponseSchema, doneDetailsResponseSchema, seasonalityResponseSchema } from './schemas'

function labelFor(key: string): string {
  return key.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export function buildFinancialRows(items: z.infer<typeof financialStatementsResponseSchema>['items']): FinancialRow[] {
  const paths = new Map<string, { key: string; depth: number; expandable: boolean }>()
  function visit(value: unknown, path: string[], depth: number) {
    if (!value || typeof value !== 'object') return
    for (const [key, child] of Object.entries(value)) {
      const next = [...path, key]
      const expandable = Boolean(child && typeof child === 'object')
      paths.set(next.join('.'), { key, depth, expandable })
      if (expandable) visit(child, next, depth + 1)
    }
  }
  for (const item of items) visit(item.data, [], 0)
  return [...paths].map(([path, definition]) => ({
    key: path, label: labelFor(definition.key), depth: definition.depth, expandable: definition.expandable,
    values: items.map((item) => {
      let value: unknown = item.data
      for (const segment of path.split('.')) value = value && typeof value === 'object' ? (value as Record<string, unknown>)[segment] : null
      return typeof value === 'number' ? value : null
    }),
  }))
}

export function normalizeBrokerSummary(value: z.infer<typeof brokerSummaryResponseSchema>) {
  return { symbol: value.stock_code, levels: value.broker_levels, startDate: value.broker_start_date, endDate: value.broker_end_date,
    brokers: value.brokers.map((row) => ({
      code: row.broker_code, name: row.broker_name, buyValue: row.bval, sellValue: row.sval, netValue: row.nval,
      buyVolume: row.bvol, sellVolume: row.svol, netVolume: row.nvol,
      buyFrequency: row.bfrq, sellFrequency: row.sfrq, netFrequency: row.bfrq - row.sfrq,
    })).sort((a, b) => b.netValue - a.netValue) }
}

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const
export function normalizeSeasonality(value: z.infer<typeof seasonalityResponseSchema>) {
  return {
    symbol: value.stock_code, months: [...months],
    rows: value.years.map((year) => ({ year, average: value.yearly_avg[year] ?? null, values: months.map((month) => value.monthly_returns[month]?.[year] ?? null) })),
    summary: months.map((month) => ({ month, average: value.summary[month]?.avg ?? null, upProbability: value.summary[month]?.up_prob ?? null, samples: value.summary[month]?.total ?? 0 })),
  }
}

export function normalizeDoneDetails(value: z.infer<typeof doneDetailsResponseSchema>) {
  return { symbol: value.code, date: value.date, total: value.total, page: value.page, perPage: value.per_page, totalPages: value.total_pages,
    rows: value.data.map((row) => ({ time: row.time, board: row.market_board, price: row.price_num, lots: row.qty_num, value: row.value_raw,
      buyer: row.buyer, seller: row.seller, buyerType: row.buyer_type, sellerType: row.seller_type, aggressor: row.action })) }
}
