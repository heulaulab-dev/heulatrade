'use client'
import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { PanelMessage } from './panel-status'
import { formatNumber } from '@/lib/format'
import type { Tables } from '@/lib/supabase/database.types'

type AlertRow = Pick<Tables<'alerts'>, 'id' | 'symbol' | 'metric' | 'operator' | 'threshold' | 'enabled' | 'last_triggered_at'>
type NotificationRow = Pick<Tables<'notifications'>, 'id' | 'title' | 'message' | 'created_at' | 'read_at'>

export function AlertsPanel({ userId, symbol }: { userId: string | null; symbol: string | null }) {
  const client = useMemo(() => userId ? createClient() : null, [userId])
  const queryClient = useQueryClient()
  const [ticker, setTicker] = useState(symbol ?? '')
  const [metric, setMetric] = useState('PRICE')
  const [operator, setOperator] = useState('GT')
  const [threshold, setThreshold] = useState('')
  const [message, setMessage] = useState('')
  const alerts = useQuery({ queryKey: ['alerts', userId], enabled: Boolean(client), queryFn: async () => { const { data, error } = await client!.from('alerts').select('id,symbol,metric,operator,threshold,enabled,last_triggered_at').order('created_at', { ascending: false }); if (error) throw error; return data as AlertRow[] } })
  const notifications = useQuery({ queryKey: ['notifications', userId], enabled: Boolean(client), queryFn: async () => { const { data, error } = await client!.from('notifications').select('id,title,message,created_at,read_at').order('created_at', { ascending: false }).limit(30); if (error) throw error; return data as NotificationRow[] } })
  async function createAlert(event: React.FormEvent) {
    event.preventDefault(); if (!client || !userId) return
    const clean = ticker.trim().toUpperCase()
    const value = Number(threshold)
    if (!/^[A-Z0-9]{1,12}$/.test(clean) || threshold.trim() === '' || !Number.isFinite(value)) { setMessage('Enter a valid ticker and threshold.'); return }
    const { error } = await client.from('alerts').insert({ symbol: clean, metric, operator, threshold: value })
    if (error) setMessage(error.message)
    else { setMessage('Alert saved.'); setThreshold(''); queryClient.invalidateQueries({ queryKey: ['alerts', userId] }) }
  }
  async function toggle(row: AlertRow) { if (!client) return; const { error } = await client.from('alerts').update({ enabled: !row.enabled }).eq('id', row.id); if (error) setMessage(error.message); else queryClient.invalidateQueries({ queryKey: ['alerts', userId] }) }
  async function markRead(id: string) { if (!client) return; const { error } = await client.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id); if (error) setMessage(error.message); else queryClient.invalidateQueries({ queryKey: ['notifications', userId] }) }
  if (!client) return <PanelMessage state="UNAVAILABLE" detail="Sign in with a configured Supabase project to use alerts." />
  return <div className="flex h-full flex-col">
    <form onSubmit={createAlert} className="flex flex-wrap gap-1 border-b border-[var(--color-iron)] p-1">
      <input aria-label="Alert symbol" className="terminal-input w-20" placeholder="CODE" value={ticker} onChange={(event) => setTicker(event.target.value)} />
      <select aria-label="Alert metric" className="terminal-input" value={metric} onChange={(event) => setMetric(event.target.value)}><option value="PRICE">PRICE · IDR</option><option value="DAILY_CHANGE">DAILY CHANGE · %</option><option value="FOREIGN_NET">FOREIGN NET · SHARES</option><option value="VOLUME">VOLUME · SHARES</option><option value="VOLUME_RATIO_20D">VOLUME / 20D AVG · ×</option></select>
      <select aria-label="Alert operator" className="terminal-input" value={operator} onChange={(event) => setOperator(event.target.value)}><option value="GT">&gt;</option><option value="GTE">≥</option><option value="LT">&lt;</option><option value="LTE">≤</option></select>
      <input aria-label="Alert threshold" className="terminal-input w-24" inputMode="decimal" placeholder="THRESHOLD" value={threshold} onChange={(event) => setThreshold(event.target.value)} />
      <button className="terminal-action border border-[var(--color-slate)]" type="submit">CREATE</button>
    </form>
    {message && <p role="status" className="p-1 text-[var(--color-fog)]">{message}</p>}
    <div className="terminal-scroll min-h-0 flex-1 overflow-auto">
      <div className="border-b border-[var(--color-slate)] px-2 py-1 text-[10px] text-[var(--color-ash)]">PRICE & FLOW ALERTS</div>
      {alerts.isPending ? <PanelMessage state="LOADING" /> : alerts.isError ? <PanelMessage state="ERROR" detail={alerts.error.message} retry={() => alerts.refetch()} /> : !alerts.data.length ? <PanelMessage state="EMPTY" detail="No alerts configured." /> : <table className="mono-table"><thead><tr><th>CODE</th><th>METRIC</th><th>RULE</th><th>STATE</th></tr></thead><tbody>{alerts.data.map((row) => <tr key={row.id}><td className="cyan">{row.symbol}</td><td>{row.metric}</td><td>{row.operator} {formatNumber(row.threshold)}</td><td><button className="terminal-action" onClick={() => toggle(row)}>{row.enabled ? row.last_triggered_at ? 'TRIGGERED' : 'ACTIVE' : 'DISABLED'}</button></td></tr>)}</tbody></table>}
      <div className="border-y border-[var(--color-slate)] px-2 py-1 text-[10px] text-[var(--color-ash)]">NOTIFICATIONS</div>
      {notifications.isPending ? <PanelMessage state="LOADING" /> : notifications.isError ? <PanelMessage state="ERROR" detail={notifications.error.message} retry={() => notifications.refetch()} /> : !notifications.data.length ? <PanelMessage state="EMPTY" detail="No notifications." /> : <ul>{notifications.data.map((row) => <li key={row.id} className="flex items-start gap-2 border-b border-[var(--color-iron)] px-2 py-1"><span className={row.read_at ? 'muted' : 'cyan'}>{row.read_at ? '○' : '●'}</span><div className="min-w-0 flex-1"><div>{row.title}</div><p className="muted">{row.message}</p></div>{!row.read_at && <button className="terminal-action" onClick={() => markRead(row.id)}>READ</button>}</li>)}</ul>}
    </div>
  </div>
}
