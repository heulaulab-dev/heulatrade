'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { actionsQuery, fundamentalsQuery, overviewQuery, profileQuery } from '@/lib/api/client'
import { formatCompact, formatNumber, formatPercent, marketDirection } from '@/lib/format'
import { PanelMessage, PanelStatus } from './panel-status'

export function MarketOverview({ onSelect }: { onSelect: (symbol: string) => void }) {
  const [rank, setRank] = useState<'GAINERS' | 'LOSERS' | 'VALUE' | 'VOLUME' | 'FREQUENCY'>('GAINERS')
  const query = useQuery({ queryKey: ['overview'], queryFn: overviewQuery })
  if (query.isPending) return <PanelMessage state="LOADING" detail="Loading latest IDX session" />
  if (query.isError) return <PanelMessage state="ERROR" detail={query.error.message} retry={() => query.refetch()} />
  const { indices, breadth, movers } = query.data.data
  const sorted = [...movers].filter((row) => row.symbol).sort((a, b) => {
    const get = (row: typeof a) => rank === 'GAINERS' || rank === 'LOSERS' ? row.changePercent : rank === 'VALUE' ? row.value : rank === 'VOLUME' ? row.volume : row.frequency
    const av = get(a), bv = get(b)
    return av === null ? 1 : bv === null ? -1 : rank === 'LOSERS' ? av - bv : bv - av
  }).slice(0, 30)
  return <div className="flex h-full flex-col">
    <div className="terminal-scroll flex shrink-0 gap-4 overflow-x-auto border-b border-[var(--color-iron)] px-2 py-2">{indices.filter((row) => row.code).slice(0, 10).map((row) => <div key={row.code} className="shrink-0"><span className="cyan">{row.code}</span><span className="ml-2">{formatNumber(row.close)}</span><span className={`ml-2 ${marketDirection(row.changePercent)}`}>{formatPercent(row.changePercent)}</span></div>)}</div>
    <div className="flex flex-wrap gap-x-4 gap-y-1 border-b border-[var(--color-iron)] px-2 py-1 text-[10px]"><span className="positive">▲ {breadth.advancers} ADV</span><span className="negative">▼ {breadth.decliners} DEC</span><span className="muted">{breadth.unchanged} UNCH</span><span>VALUE {formatCompact(breadth.value)}</span><span>VOL {formatCompact(breadth.volume)}</span><span>FREQ {formatCompact(breadth.frequency)}</span></div>
    <div className="flex gap-1 border-b border-[var(--color-iron)] p-1">{(['GAINERS', 'LOSERS', 'VALUE', 'VOLUME', 'FREQUENCY'] as const).map((choice) => <button key={choice} data-active={rank === choice} className="terminal-action" onClick={() => setRank(choice)}>{choice}</button>)}</div>
    <div className="terminal-scroll min-h-0 flex-1 overflow-auto">{!sorted.length ? <PanelMessage state="EMPTY" detail="No stocks in the latest stored session." /> : <table className="mono-table"><thead><tr><th>CODE</th><th className="numeric">LAST</th><th className="numeric">CHG</th><th className="numeric">VALUE</th><th className="numeric">VOL</th></tr></thead><tbody>{sorted.map((row) => <tr key={row.symbol}><td><button className="cyan" onClick={() => row.symbol && onSelect(row.symbol)}>{row.symbol}</button></td><td className="numeric">{formatNumber(row.close)}</td><td className={`numeric ${marketDirection(row.changePercent)}`}>{row.changePercent !== null ? row.changePercent >= 0 ? '▲ ' : '▼ ' : ''}{formatPercent(row.changePercent)}</td><td className="numeric">{formatCompact(row.value)}</td><td className="numeric">{formatCompact(row.volume)}</td></tr>)}</tbody></table>}</div>
    <div className="border-t border-[var(--color-iron)] px-2 py-1 text-[10px]"><PanelStatus meta={query.data.meta} /></div>
  </div>
}

const metricLabels: Record<string, string> = { sales: 'REVENUE', operatingProfit: 'OPERATING INCOME', netIncome: 'NET INCOME', assets: 'ASSETS', liabilities: 'LIABILITIES', equity: 'EQUITY', eps: 'EPS', per: 'PER', pbv: 'PBV', roa: 'ROA', roe: 'ROE', npm: 'NET MARGIN', opm: 'OPERATING MARGIN', der: 'DER', marketCap: 'MARKET CAP', dividendYield: 'DIVIDEND YIELD' }
export function FundamentalsPanel({ symbol }: { symbol: string }) {
  const query = useQuery({ queryKey: ['fundamentals', symbol], queryFn: () => fundamentalsQuery(symbol) })
  if (query.isPending) return <PanelMessage state="LOADING" />
  if (query.isError) return <PanelMessage state="ERROR" detail={query.error.message} retry={() => query.refetch()} />
  const rows = query.data.data
  if (!rows.length) return <PanelMessage state="EMPTY" detail={`No ingested fundamentals for ${symbol}.`} />
  return <div className="flex h-full flex-col"><div className="terminal-scroll min-h-0 flex-1 overflow-auto"><div className="border-b border-[var(--color-iron)] px-2 py-1 text-[10px] text-[var(--color-ash)]">LATEST · {rows[0].periodDate ?? 'PERIOD UNKNOWN'} · {rows[0].periodType}</div><table className="mono-table"><thead><tr><th>METRIC</th><th className="numeric">VALUE</th></tr></thead><tbody>{Object.entries(metricLabels).map(([key, label]) => <tr key={key}><td>{label}</td><td className="numeric">{formatNumber(rows[0].metrics[key])}</td></tr>)}</tbody></table><div className="border-y border-[var(--color-slate)] px-2 py-1 text-[10px] text-[var(--color-ash)]">HISTORY · REVENUE / NET INCOME / EPS / ROE</div><table className="mono-table"><thead><tr><th>PERIOD</th><th>TYPE</th><th className="numeric">REVENUE</th><th className="numeric">NET</th><th className="numeric">EPS</th><th className="numeric">ROE</th></tr></thead><tbody>{rows.map((row, index) => <tr key={`${row.periodDate}-${index}`}><td>{row.periodDate ?? '—'}</td><td className="muted">{row.periodType}</td><td className="numeric">{formatCompact(row.metrics.sales)}</td><td className="numeric">{formatCompact(row.metrics.netIncome)}</td><td className="numeric">{formatNumber(row.metrics.eps)}</td><td className="numeric">{formatNumber(row.metrics.roe)}</td></tr>)}</tbody></table></div><div className="border-t border-[var(--color-iron)] px-2 py-1 text-[10px]"><PanelStatus meta={query.data.meta} /></div></div>
}

function People({ heading, rows }: { heading: string; rows: Record<string, unknown>[] }) {
  return <><div className="border-y border-[var(--color-iron)] px-2 py-1 text-[10px] text-[var(--color-ash)]">{heading}</div>{rows.length ? <ul>{rows.map((row, index) => <li key={index} className="flex gap-3 border-b border-[var(--color-iron)] px-2 py-1"><span>{String(row.Nama ?? row.NamaPemegangSaham ?? row.Name ?? '—')}</span><span className="ml-auto muted">{String(row.Jabatan ?? row.Persentase ?? row.Percentage ?? '—')}</span></li>)}</ul> : <PanelMessage state="EMPTY" detail={`No ${heading.toLowerCase()} in the ingested profile.`} />}</>
}

export function ProfilePanel({ symbol, ownership = false }: { symbol: string; ownership?: boolean }) {
  const query = useQuery({ queryKey: ['profile', symbol], queryFn: () => profileQuery(symbol) })
  if (query.isPending) return <PanelMessage state="LOADING" />
  if (query.isError) return <PanelMessage state="ERROR" detail={query.error.message} retry={() => query.refetch()} />
  const profile = query.data.data
  return <div className="flex h-full flex-col"><div className="terminal-scroll min-h-0 flex-1 overflow-auto">
    <div className="border-b border-[var(--color-iron)] p-2"><strong className="text-sm">{profile.companyName ?? symbol}</strong><div className="muted mt-1">{profile.website ? <a href={profile.website} target="_blank" rel="noopener noreferrer" className="cyan underline">{profile.website}</a> : 'WEBSITE —'}</div>{!ownership && <p className="mt-2 text-[11px] text-[var(--color-fog)]">{profile.description ?? 'DESCRIPTION UNAVAILABLE'}</p>}</div>
    {ownership ? <People heading="MAJOR SHAREHOLDERS" rows={profile.shareholders} /> : <><People heading="DIRECTORS" rows={profile.directors} /><People heading="COMMISSIONERS" rows={profile.commissioners} /><People heading="SUBSIDIARIES" rows={profile.subsidiaries} /></>}
  </div><div className="border-t border-[var(--color-iron)] px-2 py-1 text-[10px]"><PanelStatus meta={query.data.meta} /></div></div>
}

export function ActionsPanel({ symbol }: { symbol: string }) {
  const query = useQuery({ queryKey: ['actions', symbol], queryFn: () => actionsQuery(symbol) })
  if (query.isPending) return <PanelMessage state="LOADING" />
  if (query.isError) return <PanelMessage state="ERROR" detail={query.error.message} retry={() => query.refetch()} />
  if (!query.data.data.length) return <PanelMessage state="EMPTY" detail={`No ingested corporate actions for ${symbol}.`} />
  return <div className="flex h-full flex-col"><div className="terminal-scroll min-h-0 flex-1 overflow-auto"><table className="mono-table"><thead><tr><th>DATE</th><th>TYPE</th><th>DESCRIPTION</th><th>DOCUMENT</th></tr></thead><tbody>{query.data.data.map((row, index) => <tr key={index}><td>{row.date ?? '—'}</td><td>{row.type ?? '—'}</td><td className="max-w-xs truncate" title={row.description ?? ''}>{row.description ?? '—'}</td><td>{row.documentUrl ? <a href={row.documentUrl} target="_blank" rel="noopener noreferrer" className="cyan underline">SOURCE ↗</a> : '—'}</td></tr>)}</tbody></table></div><div className="border-t border-[var(--color-iron)] px-2 py-1 text-[10px]"><PanelStatus meta={query.data.meta} /></div></div>
}
