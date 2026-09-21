export type Freshness = 'SNAPSHOT' | 'HISTORICAL' | 'STALE' | 'UNAVAILABLE'

export type ProviderMeta = {
  source: 'arjum'
  fetchedAt: string
  dataAsOf: string | null
  freshness: Freshness
}

export type ProviderResult<T> = { data: T; meta: ProviderMeta }

export type FinancialValue = number | FinancialObject
export interface FinancialObject { [key: string]: FinancialValue }
export type FinancialRow = {
  key: string
  label: string
  depth: number
  expandable: boolean
  values: Array<number | null>
}

export type RunningTrade = {
  time: string
  symbol: string
  action: string
  price: number
  lots: number
  value: number
  priceChange: number
  tradeNumber: number
}

export type RunningTradeState = 'LIVE' | 'RECONNECTING' | 'MARKET BREAK' | 'MARKET CLOSED' | 'OFFLINE'
