import 'server-only'
import { ArjumClient } from './client'
import type { ProviderMeta, ProviderResult } from './contracts'
import { buildFinancialRows, normalizeBrokerSummary, normalizeDoneDetails, normalizeSeasonality } from './normalizers'
import {
  analysisResponseSchema, brokerAccumulationResponseSchema, brokerSummaryResponseSchema,
  doneDetailsResponseSchema, financialStatementsResponseSchema, healthResponseSchema,
  historyResponseSchema, insidersResponseSchema, marketCapResponseSchema, screenerResponseSchema,
  searchResponseSchema, seasonalityResponseSchema,
} from './schemas'

const client = () => new ArjumClient()
const meta = (freshness: ProviderMeta['freshness'], dataAsOf: string | null): ProviderMeta => ({ source: 'arjum', fetchedAt: new Date().toISOString(), dataAsOf, freshness })
const result = <T>(data: T, freshness: ProviderMeta['freshness'], dataAsOf: string | null): ProviderResult<T> => ({ data, meta: meta(freshness, dataAsOf) })

export async function getSearch(q: string, signal?: AbortSignal) {
  const value = await client().get('/api/search', searchResponseSchema, { q }, signal)
  return result(value.map((row) => ({ symbol: row.stock_code, companyName: row.stock_name, lastDate: row.last_date, normalizedName: row._nn, initials: row._init })), 'SNAPSHOT', value[0]?.last_date ?? null)
}
export async function getScreener(signal?: AbortSignal) {
  const value = await client().get('/api/screener/latest', screenerResponseSchema, {}, signal)
  return result({ date: value.date, source: value.source, cachedForSeconds: value.cached_for_seconds, rows: value.rows.map((row) => ({ symbol: row.stock_code, name: row.stock_name, bucket: row.bucket, flags: row.summary, wrEvent: row.wr_event, potential: row.potential, drawdown: row.drawdown, note: row.note })) }, 'SNAPSHOT', value.date)
}
export async function getAnalysis(code: string, signal?: AbortSignal) {
  const value = await client().get(`/api/analysis/${code}`, analysisResponseSchema, {}, signal)
  return result({ symbol: value.stock_code, document: value.output }, 'SNAPSHOT', null)
}
export async function getBrokerSummary(code: string, signal?: AbortSignal) {
  const value = await client().get(`/api/broker-summary/${code}`, brokerSummaryResponseSchema, {}, signal)
  return result(normalizeBrokerSummary(value), 'HISTORICAL', value.broker_end_date)
}
export async function getBrokerAccumulation(code: string, query: { startDate?: string; endDate?: string; top?: number; brokers?: string[] }, signal?: AbortSignal) {
  const value = await client().get(`/api/broker-accumulation/${code}`, brokerAccumulationResponseSchema, { start_date: query.startDate, end_date: query.endDate, top: query.top, brokers: query.brokers }, signal)
  return result({ symbol: value.code, startDate: value.start_date, endDate: value.end_date, series: value.series.map((series) => ({ code: series.broker_code, name: series.broker_name, points: series.points.map((point) => ({ date: point.date, netValue: point.nval, netVolume: point.nvol, cumulativeNetValue: point.cum_nval, buyAverage: point.bavg, sellAverage: point.savg })) })), topBuyers: value.top_buyers.map((row) => ({ code: row.broker_code, name: row.broker_name, totalNetValue: row.total_nval })), topSellers: value.top_sellers.map((row) => ({ code: row.broker_code, name: row.broker_name, totalNetValue: row.total_nval })) }, 'HISTORICAL', value.end_date)
}
export async function getHistory(code: string, query: { limit?: number; frame?: string }, signal?: AbortSignal) {
  const value = await client().get(`/api/history/${code}`, historyResponseSchema, query, signal)
  return result({ symbol: value.stock_code, frame: value.frame, rows: value.rows.map((row) => ({ time: row.date, open: row.open, high: row.high, low: row.low, close: row.close, average: row.avg, change: row.change, changePercent: row.change_pct, value: row.value, volume: row.volume, frequency: row.freq, foreignBuy: row.f_buy, foreignSell: row.f_sell, foreignNet: row.n_foreign })) }, 'HISTORICAL', value.rows[0]?.date ?? null)
}
export async function getSeasonality(code: string, signal?: AbortSignal) {
  const value = await client().get(`/api/seasonal/${code}`, seasonalityResponseSchema, {}, signal)
  return result(normalizeSeasonality(value), 'HISTORICAL', null)
}
export async function getMarketCap(query: { date?: string; page?: number; perPage?: number }, signal?: AbortSignal) {
  const value = await client().get('/api/market-cap', marketCapResponseSchema, { date: query.date, page: query.page, per_page: query.perPage }, signal)
  return result({ date: value.date, total: value.total, page: value.page, perPage: value.per_page, totalPages: value.total_pages, rows: value.data.map((row) => ({ symbol: row.code, name: row.name, close: row.close, marketCap: row.market_cap, listedShares: row.listed_shares, turnover: row.turnover_ratio })) }, 'HISTORICAL', value.date)
}
export async function getFinancialStatements(code: string, query: { reportType?: string; period?: string; limit?: number; year?: string }, signal?: AbortSignal) {
  const value = await client().get(`/api/financial-statements/${code}`, financialStatementsResponseSchema, { report_type: query.reportType, period: query.period, limit: query.limit, year: query.year }, signal)
  return result({ symbol: value.stock_code, reportType: value.report_type, period: value.period, count: value.count, periods: value.items.map((item) => ({ year: item.year, quarter: item.quarter, label: item.label, fetchedAt: item.fetched_at })), rows: buildFinancialRows(value.items) }, 'HISTORICAL', value.items[0]?.fetched_at ?? null)
}
export async function getInsiders(code: string, query: { page?: number; limit?: number; actionType?: string }, signal?: AbortSignal) {
  const value = await client().get(`/api/insiders/${code}`, insidersResponseSchema, { page: query.page, limit: query.limit, action_type: query.actionType }, signal)
  return result({ symbol: value.stock_code, count: value.count, total: value.total, page: value.page, pageSize: value.page_size, totalPages: value.total_pages, rows: value.items.map((row) => ({ person: row.name, date: row.date, action: row.action_type.toUpperCase(), nationality: row.nationality, previousHolding: row.previous_value, previousPercentage: row.previous_percentage, currentHolding: row.current_value, currentPercentage: row.current_percentage, sharesChange: row.changes_value, percentageChange: row.changes_percentage, price: row.price_formatted, broker: row.broker_code, roles: row.badges })) }, 'HISTORICAL', value.items[0]?.date ?? null)
}
export async function getDoneDetails(query: { code: string; date?: string; page?: number; perPage?: number }, signal?: AbortSignal) {
  const value = await client().get('/api/done-details', doneDetailsResponseSchema, { code: query.code, date: query.date, page: query.page, per_page: query.perPage }, signal)
  const normalized = normalizeDoneDetails(value)
  return result(normalized, 'HISTORICAL', normalized.date)
}
export async function getProviderHealth(signal?: AbortSignal) {
  const value = await client().get('/api/health', healthResponseSchema, {}, signal)
  return result(value, 'SNAPSHOT', null)
}
