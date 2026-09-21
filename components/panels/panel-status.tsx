'use client'
import type { MarketMeta } from '@/lib/market/contracts'

export function PanelStatus({ meta }: { meta: MarketMeta | null }) {
  if (!meta) return <span className="muted">UNAVAILABLE</span>
  const label = meta.freshness === 'UNAVAILABLE' ? 'UNAVAILABLE' : `${meta.freshness} · ${meta.dataAsOf ?? 'AS-OF UNKNOWN'}`
  return <span title={`Source: ${meta.source} · Fetched: ${meta.fetchedAt}`} className={meta.freshness === 'STALE' ? 'text-[var(--warning)]' : 'muted'}>{label}</span>
}
export function PanelMessage({ state, detail, retry }: { state: 'LOADING' | 'EMPTY' | 'ERROR' | 'UNAVAILABLE'; detail?: string; retry?: () => void }) {
  return <div className="flex h-full min-h-32 flex-col items-center justify-center gap-2 p-4 text-center" role={state === 'ERROR' ? 'alert' : 'status'}>
    <span className="text-[11px] tracking-wide text-[var(--color-fog)]">{state}</span>
    {detail && <span className="max-w-md text-[11px] text-[var(--color-ash)]">{detail}</span>}
    {retry && <button className="terminal-action border border-[var(--color-slate)]" onClick={retry}>R RETRY</button>}
  </div>
}
