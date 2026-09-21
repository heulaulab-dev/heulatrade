'use client'
import { useQuery } from '@tanstack/react-query'
import { signalsQuery } from '@/lib/api/client'
import { formatNumber, marketDirection } from '@/lib/format'
import { PanelMessage, PanelStatus } from './panel-status'

export function SignalsPanel({ onSelect }: { onSelect: (symbol: string) => void }) {
  const query = useQuery({ queryKey: ['signals'], queryFn: signalsQuery, staleTime: 300_000 })
  if (query.isPending) return <PanelMessage state="LOADING" />
  if (query.isError) return <PanelMessage state="ERROR" detail={query.error.message} retry={() => query.refetch()} />
  const rows = query.data.data.foreignFlow
  return <div className="flex h-full flex-col"><div className="border-b border-[var(--color-iron)] px-2 py-1 text-[10px] text-[var(--color-ash)]">FOREIGN FLOW RADAR · {query.data.data.tradingDate} · 5 SESSIONS · RESEARCH ONLY</div><div className="terminal-scroll min-h-0 flex-1 overflow-auto">
    {!rows.length ? <PanelMessage state="EMPTY" detail="No securities met the upstream radar thresholds." /> : <table className="mono-table"><thead><tr><th>CODE</th><th className="numeric">CLOSE</th><th className="numeric">NET M SH</th><th className="numeric">% FLOAT</th><th>SIGNAL</th></tr></thead><tbody>{rows.map((row) => <tr key={row.symbol}><td><button className="cyan" onClick={() => onSelect(row.symbol)}>{row.symbol}</button></td><td className="numeric">{formatNumber(row.close)}</td><td className={`numeric ${marketDirection(row.netForeignMillionShares)}`}>{formatNumber(row.netForeignMillionShares)}</td><td className={`numeric ${marketDirection(row.percentFloat)}`}>{formatNumber(row.percentFloat)}%</td><td className="muted">{row.signal.toUpperCase()}</td></tr>)}</tbody></table>}
  </div><div className="border-t border-[var(--color-iron)] px-2 py-1 text-[10px]"><PanelStatus meta={query.data.meta} /> · SOURCE idx-bei</div></div>
}
