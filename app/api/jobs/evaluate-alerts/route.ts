import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { getStock } from '@/lib/market/server'
import { observedMetric, triggered, type AlertRule } from '@/lib/alerts/evaluate'
import type { Database } from '@/lib/supabase/database.types'

export const runtime = 'nodejs'
export const maxDuration = 60

const AlertRow = z.object({ id: z.string().uuid(), symbol: z.string().regex(/^[A-Z0-9]{1,12}$/), metric: z.enum(['PRICE', 'DAILY_CHANGE', 'FOREIGN_NET', 'VOLUME', 'VOLUME_RATIO_20D']), operator: z.enum(['GT', 'GTE', 'LT', 'LTE']), threshold: z.coerce.number().finite() })

export async function POST(request: Request) {
  const secret = process.env.ALERT_JOB_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey || !process.env.MARKET_API_URL) return NextResponse.json({ error: 'NOT_CONFIGURED' }, { status: 503 })
  const admin = createClient<Database>(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  let evaluated = 0, triggeredCount = 0, unavailable = 0, failed = 0
  const bySymbol = new Map<string, Awaited<ReturnType<typeof getStock>> | null>()
  for (let offset = 0; ; offset += 200) {
    const { data, error } = await admin.from('alerts').select('id,symbol,metric,operator,threshold').eq('enabled', true).order('id').range(offset, offset + 199)
    if (error) return NextResponse.json({ error: 'ALERT_QUERY_FAILED' }, { status: 502 })
    if (!data?.length) break
    for (const raw of data) {
      const parsed = AlertRow.safeParse(raw)
      if (!parsed.success) { failed++; continue }
      const alert = parsed.data
      if (!bySymbol.has(alert.symbol)) {
        try { bySymbol.set(alert.symbol, await getStock(alert.symbol)) }
        catch { bySymbol.set(alert.symbol, null) }
      }
      const stock = bySymbol.get(alert.symbol)
      if (!stock || stock.meta.freshness === 'STALE' || stock.meta.freshness === 'UNAVAILABLE' || stock.meta.freshness === 'DELAYED' || !stock.meta.dataAsOf || stock.data.quote.timestamp !== stock.meta.dataAsOf) { unavailable++; continue }
      const value = observedMetric(alert.metric as AlertRule['metric'], stock.data.quote, stock.data.candles)
      if (value === null) { unavailable++; continue }
      evaluated++
      if (!triggered(alert, value)) continue
      const { error: insertError, data: inserted } = await admin.from('alert_events').upsert({ alert_id: alert.id, observed_value: value, observed_as_of: stock.meta.dataAsOf }, { onConflict: 'alert_id,observed_as_of', ignoreDuplicates: true }).select('id')
      if (insertError) failed++
      else if (inserted?.length) triggeredCount++
    }
    if (data.length < 200) break
  }
  return NextResponse.json({ evaluated, triggered: triggeredCount, unavailable, failed }, { headers: { 'cache-control': 'no-store' } })
}
