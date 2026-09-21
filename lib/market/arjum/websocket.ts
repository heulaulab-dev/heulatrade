import { z } from 'zod'
import type { RunningTrade, RunningTradeState } from './contracts'

const wireTradeSchema = z.object({ t: z.string(), c: z.string(), a: z.string(), p: z.number(), l: z.number(), v: z.number(), pc: z.number(), tn: z.number() })
const wireTopSchema = z.object({ c: z.string(), v: z.number(), tn: z.number() }).passthrough()
const snapshotSchema = z.object({ type: z.literal('snapshot'), market_status: z.string().optional(), session_status: z.string().optional(), data: z.array(wireTradeSchema) })
const tradeSchema = wireTradeSchema.extend({ type: z.literal('trade') })
const top5Schema = z.object({ type: z.literal('top5'), data: z.array(wireTopSchema) })

function trade(row: z.infer<typeof wireTradeSchema>): RunningTrade {
  return { time: row.t, symbol: row.c, action: row.a, price: row.p, lots: row.l, value: row.v, priceChange: row.pc, tradeNumber: row.tn }
}

export function normalizeRunningTradeMessage(input: unknown) {
  const type = z.object({ type: z.string() }).parse(input).type
  if (type === 'snapshot') { const value = snapshotSchema.parse(input); return { type, marketStatus: value.market_status ?? null, sessionStatus: value.session_status ?? null, trades: value.data.map(trade) } as const }
  if (type === 'trade') return { type, trade: trade(tradeSchema.parse(input)) } as const
  if (type === 'top5') return { type, rows: top5Schema.parse(input).data.map((row) => ({ symbol: row.c, value: row.v, tradeCount: row.tn })) } as const
  throw new Error(`Unsupported running-trade message: ${type}`)
}

export function closePolicy(code: number): { reconnect: boolean; minimumDelayMs: number; state: RunningTradeState; reason: string } {
  if (code === 4401) return { reconnect: false, minimumDelayMs: 0, state: 'OFFLINE', reason: 'PROVIDER_AUTHENTICATION_FAILED' }
  if (code === 4403) return { reconnect: false, minimumDelayMs: 0, state: 'OFFLINE', reason: 'SUBSCRIPTION_REQUIRED' }
  if (code === 4408) return { reconnect: true, minimumDelayMs: 60_000, state: 'RECONNECTING', reason: 'CONNECTION_TAKEOVER' }
  return { reconnect: true, minimumDelayMs: 1_000, state: 'RECONNECTING', reason: 'UPSTREAM_DISCONNECTED' }
}
