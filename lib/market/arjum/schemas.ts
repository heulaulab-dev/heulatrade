import { z } from 'zod'

const finiteNumber = z.number().finite()
const nullableFinite = finiteNumber.nullable()

export const searchItemSchema = z.object({
  stock_code: z.string(), stock_name: z.string(), last_date: z.string(),
  _nn: z.string(), _nc: z.string(), _init: z.string(),
})
export const searchResponseSchema = z.array(searchItemSchema)

export const screenerResponseSchema = z.object({
  date: z.string(), source: z.string(),
  rows: z.array(z.object({
    stock_code: z.string(), stock_name: z.string(), bucket: z.string(), summary: z.string(),
    wr_event: z.union([finiteNumber, z.string()]).nullable(),
    potential: z.union([finiteNumber, z.string()]).nullable(),
    drawdown: z.union([finiteNumber, z.string()]).nullable(), note: z.string(),
  })),
  raw: z.string(), cached_for_seconds: finiteNumber,
})

export const analysisResponseSchema = z.object({ stock_code: z.string(), output: z.string() })

const brokerBaseSchema = z.object({ broker_code: z.string(), broker_name: z.string() })
export const brokerSummaryResponseSchema = z.object({
  stock_code: z.string(),
  brokers: z.array(brokerBaseSchema.extend({
    bval: finiteNumber, bvol: finiteNumber, bfrq: finiteNumber,
    sval: finiteNumber, svol: finiteNumber, sfrq: finiteNumber,
    nval: finiteNumber, nvol: finiteNumber,
  })),
  broker_levels: z.array(z.object({
    buy: brokerBaseSchema.extend({ bval: finiteNumber, bvol: finiteNumber, bfrq: finiteNumber, bavg: finiteNumber }),
    sell: brokerBaseSchema.extend({ sval: finiteNumber, svol: finiteNumber, sfrq: finiteNumber, savg: finiteNumber }),
  })),
  broker_start_date: z.string(), broker_end_date: z.string(), broker_date_min: z.string(), broker_date_max: z.string(),
  broker_net: z.boolean(), flow: z.string(),
})

export const brokerAccumulationResponseSchema = z.object({
  code: z.string(), start_date: z.string(), end_date: z.string(),
  series: z.array(brokerBaseSchema.extend({ points: z.array(z.object({
    date: z.string(), nval: finiteNumber, nvol: finiteNumber, cum_nval: finiteNumber,
    bavg: nullableFinite, savg: nullableFinite,
  })) })),
  top_buyers: z.array(brokerBaseSchema.extend({ total_nval: finiteNumber })),
  top_sellers: z.array(brokerBaseSchema.extend({ total_nval: finiteNumber })),
})

export const historyResponseSchema = z.object({
  stock_code: z.string(), frame: z.string(), rows: z.array(z.object({
    date: z.string(), close: finiteNumber, change: finiteNumber, change_pct: finiteNumber,
    value: finiteNumber, volume: finiteNumber, freq: finiteNumber, f_buy: finiteNumber,
    f_sell: finiteNumber, n_foreign: finiteNumber, open: finiteNumber, high: finiteNumber,
    low: finiteNumber, avg: finiteNumber,
  })),
})

const monthSummarySchema = z.object({ avg: finiteNumber, up: finiteNumber, down: finiteNumber, total: finiteNumber, up_prob: finiteNumber })
export const seasonalityResponseSchema = z.object({
  stock_code: z.string(), years: z.array(z.string()),
  monthly_returns: z.record(z.string(), z.record(z.string(), finiteNumber)),
  summary: z.record(z.string(), monthSummarySchema),
  yearly_avg: z.record(z.string(), finiteNumber),
})

export const marketCapResponseSchema = z.object({
  date: z.string(), total: finiteNumber, page: finiteNumber, per_page: finiteNumber, total_pages: finiteNumber,
  data: z.array(z.object({
    code: z.string(), name: z.string(), close: finiteNumber, listed_shares: finiteNumber,
    listed_shares_label: z.string(), market_cap: finiteNumber, market_cap_label: z.string(),
    turnover_ratio: finiteNumber, turnover_ratio_label: z.string(),
  })),
})

export type FinancialNode = number | { [key: string]: FinancialNode }
export const financialNodeSchema: z.ZodType<FinancialNode> = z.lazy(() => z.union([finiteNumber, z.record(z.string(), financialNodeSchema)]))
export const financialStatementsResponseSchema = z.object({
  stock_code: z.string(), report_type: z.string(), period: z.string(), count: finiteNumber,
  items: z.array(z.object({ year: z.string(), quarter: z.string(), label: z.string(), fetched_at: z.string(), data: z.record(z.string(), financialNodeSchema) })),
})

export const insidersResponseSchema = z.object({
  stock_code: z.string(), count: finiteNumber, total: finiteNumber, page: finiteNumber, page_size: finiteNumber, total_pages: finiteNumber,
  items: z.array(z.object({
    name: z.string(), date: z.string(), action_type: z.string(), nationality: z.string(),
    previous_value: z.string(), previous_percentage: z.string(), current_value: z.string(),
    current_percentage: z.string(), changes_value: z.string(), changes_percentage: z.string(),
    price_formatted: z.string(), broker_code: z.string(), badges: z.array(z.string()),
  })),
})

export const doneDetailsResponseSchema = z.object({
  code: z.string(), date: z.string(), total: finiteNumber, page: finiteNumber, per_page: finiteNumber, total_pages: finiteNumber,
  data: z.array(z.object({
    time: z.string(), market_date: z.string(), market_board: z.string(), price: z.string(), price_num: finiteNumber,
    lot: z.string(), qty_num: finiteNumber, value_raw: finiteNumber, buyer: z.string(), seller: z.string(),
    buyer_type: z.string(), seller_type: z.string(), buy_order_number: z.string(), sell_order_number: z.string(), action: z.string(),
  })), elapsed_ms: finiteNumber,
})

export const healthResponseSchema = z.object({ ok: z.boolean(), status: z.string() })
