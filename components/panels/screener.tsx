'use client'
import { useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useVirtualizer } from '@tanstack/react-virtual'
import { screenerQuery } from '@/lib/api/client'
import { ScreenConditionSchema, ScreenFieldSchema, type ScreenCondition } from '@/lib/market/contracts'
import { formatCompact, formatNumber, formatPercent, marketDirection } from '@/lib/format'
import { createClient } from '@/lib/supabase/client'
import { PanelMessage, PanelStatus } from './panel-status'

const fields = ScreenFieldSchema.options
const labels: Record<string, string> = { price: 'PRICE', volume: 'VOLUME', value: 'VALUE', frequency: 'FREQUENCY', foreignNetShares: 'FOREIGN NET SHARES', marketCap: 'MARKET CAP', per: 'PER', pbv: 'PBV', roe: 'ROE', roa: 'ROA', eps: 'EPS', der: 'DER', dividendYield: 'DIV YIELD', change1D: 'CHANGE 1D' }
const defaultCondition: ScreenCondition = { field: 'value', operator: 'GT', value: 0, connective: 'AND' }
const columns = ['symbol', 'name', 'price', 'change1D', 'value', 'volume', 'foreignNetShares', 'per', 'pbv', 'roe'] as const
type SortField = typeof columns[number]

function csvCell(value: unknown): string {
  const content = value === null || value === undefined ? '' : String(value)
  return `"${content.replaceAll('"', '""')}"`
}

export function ScreenerPanel({ userId, onSelect }: { userId: string | null; onSelect: (symbol: string) => void }) {
  const client = useMemo(() => userId ? createClient() : null, [userId])
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState<ScreenCondition[]>([])
  const [applied, setApplied] = useState<ScreenCondition[]>([])
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')
  const [sort, setSort] = useState<{ field: SortField; descending: boolean }>({ field: 'value', descending: true })
  const [hidden, setHidden] = useState<string[]>([])
  const [pinned, setPinned] = useState<string[]>(['symbol'])
  const [selected, setSelected] = useState(0)
  const scroller = useRef<HTMLDivElement>(null)
  const saved = useQuery({ queryKey: ['saved-screeners', userId], enabled: Boolean(client), queryFn: async () => { const { data, error } = await client!.from('saved_screeners').select('id,name,conditions,sort_config').order('updated_at', { ascending: false }); if (error) throw error; return data ?? [] } })
  const result = useQuery({ queryKey: ['screener', applied], queryFn: () => screenerQuery(applied), staleTime: 30_000 })
  const rows = useMemo(() => {
    const data = [...(result.data?.data.rows ?? [])]
    data.sort((a, b) => {
      const av = a[sort.field], bv = b[sort.field]
      if (av == null) return bv == null ? 0 : 1
      if (bv == null) return -1
      const order = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv))
      return sort.descending ? -order : order
    })
    return data
  }, [result.data, sort])
  // TanStack Virtual owns its scroll measurements; React Compiler must not memoize this hook.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({ count: rows.length, getScrollElement: () => scroller.current, estimateSize: () => 29, overscan: 12 })
  const shownColumns = columns.filter((column) => !hidden.includes(column))
  function update(index: number, patch: Partial<ScreenCondition>) { setDraft((old) => old.map((condition, i) => i === index ? { ...condition, ...patch } : condition)) }
  async function save() {
    if (!client || !userId) { setMessage('Sign in to save screeners.'); return }
    const cleanName = name.trim()
    if (!cleanName || cleanName.length > 80) { setMessage('Enter a name up to 80 characters.'); return }
    const { error } = await client.from('saved_screeners').insert({ name: cleanName, conditions: draft, sort_config: sort })
    if (error) setMessage(error.message)
    else { setMessage('SAVED'); queryClient.invalidateQueries({ queryKey: ['saved-screeners', userId] }) }
  }
  function exportCsv() {
    const content = [shownColumns.join(','), ...rows.map((row) => shownColumns.map((column) => csvCell(row[column])).join(','))].join('\r\n')
    const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }))
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'heulatrade-screener.csv'; anchor.click(); URL.revokeObjectURL(url)
  }
  return <div className="flex h-full min-h-0 flex-col text-[11px]">
    <div className="terminal-scroll max-h-[45%] shrink-0 overflow-auto border-b border-[var(--color-iron)] p-2">
      <div className="mb-1 flex flex-wrap items-center gap-1"><span className="mr-2 font-bold text-[var(--color-fog)]">FILTERS</span><button className="terminal-action border border-[var(--color-slate)]" onClick={() => setDraft([...draft, { ...defaultCondition }])}>+ CONDITION</button><button className="terminal-action border border-[var(--color-slate)]" onClick={() => { const valid = draft.every((condition) => ScreenConditionSchema.safeParse(condition).success); if (valid) setApplied([...draft]); else setMessage('Check filter values.') }}>RUN</button><span className="muted">{draft.length ? `${draft.length} CONDITIONS` : 'ALL SECURITIES'}</span></div>
      {draft.map((condition, index) => <div key={index} className="mb-1 flex flex-wrap gap-1">
        <select aria-label={`Connective ${index + 1}`} className="terminal-input" disabled={index === 0} value={condition.connective} onChange={(event) => update(index, { connective: event.target.value as ScreenCondition['connective'] })}><option>AND</option><option>OR</option></select>
        <select aria-label={`Field ${index + 1}`} className="terminal-input" value={condition.field} onChange={(event) => update(index, { field: event.target.value as ScreenCondition['field'] })}>{fields.map((field) => <option key={field} value={field}>{labels[field]}</option>)}</select>
        <select aria-label={`Operator ${index + 1}`} className="terminal-input" value={condition.operator} onChange={(event) => update(index, { operator: event.target.value as ScreenCondition['operator'] })}><option value="GT">&gt;</option><option value="GTE">≥</option><option value="LT">&lt;</option><option value="LTE">≤</option><option value="EQ">=</option></select>
        <input aria-label={`Value ${index + 1}`} className="terminal-input w-24" type="number" step="any" value={Number.isNaN(condition.value) ? '' : condition.value} onChange={(event) => update(index, { value: event.target.value === '' ? Number.NaN : Number(event.target.value) })} />
        <button className="terminal-action" aria-label={`Remove condition ${index + 1}`} onClick={() => setDraft(draft.filter((_, i) => i !== index))}>×</button>
      </div>)}
      <div className="mt-1 flex flex-wrap items-center gap-1 border-t border-[var(--color-iron)] pt-1"><input aria-label="Screener name" className="terminal-input w-44" placeholder="SAVED SCREEN NAME" maxLength={80} value={name} onChange={(event) => setName(event.target.value)} /><button className="terminal-action" onClick={save}>SAVE</button><select aria-label="Load saved screener" className="terminal-input max-w-44" value="" onChange={(event) => { const item = saved.data?.find((row) => row.id === event.target.value); const parsed = ScreenConditionSchema.array().safeParse(item?.conditions); if (parsed.success) { setDraft(parsed.data); setApplied(parsed.data); setName(item?.name ?? '') } else setMessage('Saved filters are incompatible.') }}><option value="">LOAD SAVED…</option>{saved.data?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>{message && <span role="status" className="text-[var(--warning)]">{message}</span>}</div>
      <div className="mt-1 text-[10px] text-[var(--color-ash)]">BROKER NET, BROKER CONCENTRATION, TECHNICAL AND MULTI-PERIOD PERFORMANCE: UNAVAILABLE FROM VERIFIED SOURCE.</div>
    </div>
    <div className="flex items-center gap-2 border-b border-[var(--color-iron)] px-2 py-1"><span>{result.data?.data.total ?? '—'} RESULTS</span><span className="flex-1" /><button className="terminal-action" onClick={exportCsv} disabled={!rows.length}>EXPORT CSV</button><PanelStatus meta={result.data?.meta ?? null} /></div>
    <div ref={scroller} role="grid" aria-label="Screener results" tabIndex={0} className="terminal-scroll min-h-0 flex-1 overflow-auto outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-ember)]" onKeyDown={(event) => { if (event.key === 'ArrowDown') { event.preventDefault(); setSelected(Math.min(rows.length - 1, selected + 1)); virtualizer.scrollToIndex(Math.min(rows.length - 1, selected + 1)) } else if (event.key === 'ArrowUp') { event.preventDefault(); setSelected(Math.max(0, selected - 1)); virtualizer.scrollToIndex(Math.max(0, selected - 1)) } else if (event.key === 'Enter' && rows[selected]) onSelect(rows[selected].symbol) }}>
      {result.isPending ? <PanelMessage state="LOADING" /> : result.isError ? <PanelMessage state="ERROR" detail={result.error.message} retry={() => result.refetch()} /> : !rows.length ? <PanelMessage state="EMPTY" detail="No securities matched the applied conditions." /> : <table className="mono-table w-full table-fixed"><thead><tr>{shownColumns.map((column) => <th key={column} className={pinned.includes(column) ? 'bg-[var(--color-carbon)]' : ''} style={{ width: column === 'name' ? 180 : column === 'symbol' ? 72 : 110 }}><div className="flex items-center gap-1"><button className="truncate" onClick={() => setSort({ field: column, descending: sort.field === column ? !sort.descending : true })}>{labels[column] ?? column.toUpperCase()}{sort.field === column ? sort.descending ? ' ↓' : ' ↑' : ''}</button><button aria-label={`Hide ${column}`} className="muted" onClick={() => setHidden([...hidden, column])}>×</button><button aria-label={`Pin ${column}`} className="muted" onClick={() => setPinned(pinned.includes(column) ? pinned.filter((item) => item !== column) : [...pinned, column])}>{pinned.includes(column) ? '◆' : '◇'}</button></div></th>)}</tr></thead><tbody><tr style={{ height: virtualizer.getVirtualItems()[0]?.start ?? 0 }} aria-hidden="true"><td colSpan={shownColumns.length} className="!p-0" /></tr>{virtualizer.getVirtualItems().map((item) => { const row = rows[item.index]; return <tr key={row.symbol} role="row" aria-selected={selected === item.index} className={`cursor-pointer ${selected === item.index ? 'bg-[var(--color-graphite)]' : ''}`} onClick={() => { setSelected(item.index); onSelect(row.symbol) }}>{shownColumns.map((column) => { const value = row[column]; return <td key={column} className={`${column === 'symbol' ? 'cyan' : ''} ${column === 'change1D' ? marketDirection(typeof value === 'number' ? value : null) : ''} truncate`} title={value == null ? 'Unavailable' : String(value)}>{value == null ? '—' : column === 'change1D' ? formatPercent(value as number) : ['value', 'volume', 'marketCap', 'foreignNetShares'].includes(column) ? formatCompact(value as number) : typeof value === 'number' ? formatNumber(value) : value}</td> })}</tr> })}<tr style={{ height: Math.max(0, virtualizer.getTotalSize() - (virtualizer.getVirtualItems().at(-1)?.end ?? 0)) }} aria-hidden="true"><td colSpan={shownColumns.length} className="!p-0" /></tr></tbody></table>}
    </div>
    {hidden.length > 0 && <div className="border-t border-[var(--color-iron)] p-1">HIDDEN: {hidden.map((column) => <button key={column} className="terminal-action" onClick={() => setHidden(hidden.filter((item) => item !== column))}>+ {labels[column]}</button>)}</div>}
  </div>
}
