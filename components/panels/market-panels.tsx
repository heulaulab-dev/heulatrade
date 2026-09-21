'use client'
import { useMemo, useState } from 'react'
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { PriceChart } from '@/components/charts/price-chart'
import { PanelMessage, PanelStatus } from './panel-status'
import { stockQuery, securitiesQuery } from '@/lib/api/client'
import { formatCompact, formatNumber, formatPercent, marketDirection } from '@/lib/format'
import { createClient } from '@/lib/supabase/client'
import { calculatePortfolio, type Transaction } from '@/lib/portfolio'
import { AlertsPanel } from './alerts'
import { SignalsPanel } from './signals'
import { ScreenerPanel } from './screener'
import { ActionsPanel, FundamentalsPanel, MarketOverview, ProfilePanel } from './research-panels'
import type { PanelType } from '@/lib/commands/registry'
import type { Quote } from '@/lib/market/contracts'

function QuoteLine({ quote }: { quote: Quote }) {
  return <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-[var(--color-iron)] px-2 py-2">
    <span className="text-[16px] font-bold">{quote.symbol}</span>
    <span className="text-[18px]">{formatNumber(quote.close)}</span>
    <span className={marketDirection(quote.changePercent)}> {quote.changePercent === null ? '—' : quote.changePercent >= 0 ? '▲ ' : '▼ '}{formatPercent(quote.changePercent)}</span>
    <span className="muted">VOL {formatCompact(quote.volume)}</span><span className="muted">VAL {formatCompact(quote.value)}</span>
  </div>
}

function StockResearch({ symbol, type }: { symbol: string | null; type: PanelType }) {
  const [mode, setMode] = useState<'CANDLE' | 'LINE' | 'AREA'>('CANDLE')
  const [range, setRange] = useState('1Y')
  const [overlays, setOverlays] = useState<string[]>(['EMA20', 'EMA50'])
  const query = useQuery({ queryKey: ['stock', symbol], queryFn: () => stockQuery(symbol!), enabled: Boolean(symbol) })
  if (!symbol) return <PanelMessage state="EMPTY" detail="Select a security with the command bar." />
  if (query.isPending) return <PanelMessage state="LOADING" detail={`Requesting ${symbol} from idx-bei`} />
  if (query.isError) return <PanelMessage state="ERROR" detail={query.error.message} retry={() => query.refetch()} />
  const { quote, candles } = query.data.data
  if (type === 'CHART') {
    const last = candles.at(-1)?.time
    const earliest = last ? new Date(last) : null
    if (earliest) earliest.setUTCDate(earliest.getUTCDate() - ({ '1W': 7, '1M': 30, '3M': 90, '6M': 180, '1Y': 365, '2Y': 730, '5Y': 1825 }[range] ?? 365))
    const visible = range === 'MAX' || !earliest ? candles : candles.filter((row) => row.time >= earliest.toISOString().slice(0, 10))
    return <div className="flex h-full flex-col">
      <QuoteLine quote={quote} />
      <div className="flex flex-wrap items-center gap-1 border-b border-[var(--color-iron)] px-1 py-0.5">
        {(['CANDLE', 'LINE', 'AREA'] as const).map((choice) => <button key={choice} className="terminal-action" data-active={mode === choice} onClick={() => setMode(choice)}>{choice}</button>)}
        <span className="mx-1 h-4 border-l border-[var(--color-slate)]" />
        {['1W', '1M', '3M', '6M', '1Y', '2Y', '5Y', 'MAX'].map((choice) => <button key={choice} className="terminal-action" data-active={range === choice} onClick={() => setRange(choice)}>{choice}</button>)}
        <span className="mx-1 h-4 border-l border-[var(--color-slate)]" />
        {['EMA20', 'EMA50', 'EMA200'].map((choice) => <button key={choice} className="terminal-action" data-active={overlays.includes(choice)} onClick={() => setOverlays((old) => old.includes(choice) ? old.filter((x) => x !== choice) : [...old, choice])}>{choice}</button>)}
      </div>
      <div className="min-h-0 flex-1">{visible.length ? <PriceChart candles={visible} mode={mode} overlays={overlays} /> : <PanelMessage state="EMPTY" detail="No candles in this range." />}</div>
      <div className="border-t border-[var(--color-iron)] px-2 py-1 text-[10px]"><PanelStatus meta={query.data.meta} /> · SOURCE idx-bei</div>
    </div>
  }
  if (type === 'FOREIGN') {
    const rows = candles.filter((row) => row.foreignBuy !== null && row.foreignSell !== null).slice(-30).reverse()
    if (!rows.length) return <PanelMessage state="UNAVAILABLE" detail="The upstream dataset has no verified foreign buy and sell series for this security." />
    return <div><QuoteLine quote={quote} /><table className="mono-table"><thead><tr><th>DATE</th><th className="numeric">BUY</th><th className="numeric">SELL</th><th className="numeric">NET</th></tr></thead><tbody>{rows.map((row) => { const net = row.foreignBuy! - row.foreignSell!; return <tr key={row.time}><td>{row.time}</td><td className="numeric">{formatCompact(row.foreignBuy)}</td><td className="numeric">{formatCompact(row.foreignSell)}</td><td className={`numeric ${marketDirection(net)}`}>{formatCompact(net)}</td></tr> })}</tbody></table><div className="p-2 text-[10px]"><PanelStatus meta={query.data.meta} /> · UNIT AS PROVIDED BY SOURCE</div></div>
  }
  return <PanelMessage state="UNAVAILABLE" detail={`${type} does not have a verified per-security contract in the running idx-bei API.`} />
}

function SecurityDirectory({ onSelect }: { onSelect: (symbol: string) => void }) {
  const [search, setSearch] = useState('')
  const query = useQuery({ queryKey: ['securities', search], queryFn: () => securitiesQuery(search) })
  return <div className="flex h-full flex-col">
    <div className="border-b border-[var(--color-iron)] p-1"><input aria-label="Search securities" className="terminal-input w-full" placeholder="SYMBOL / COMPANY" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
    <div className="terminal-scroll min-h-0 flex-1 overflow-auto">
      {query.isPending ? <PanelMessage state="LOADING" /> : query.isError ? <PanelMessage state="ERROR" detail={query.error.message} retry={() => query.refetch()} /> : !query.data.data.length ? <PanelMessage state="EMPTY" detail="No securities matched." /> : <table className="mono-table"><thead><tr><th>CODE</th><th>COMPANY</th><th>SECTOR</th></tr></thead><tbody>{query.data.data.map((row) => <tr key={row.symbol} tabIndex={0} onClick={() => onSelect(row.symbol)} onKeyDown={(event) => { if (event.key === 'Enter') onSelect(row.symbol) }} className="cursor-pointer"><td className="cyan">{row.symbol}</td><td>{row.companyName}</td><td className="muted">{row.sector ?? '—'}</td></tr>)}</tbody></table>}
    </div>
    <div className="border-t border-[var(--color-iron)] px-2 py-1 text-[10px]"><PanelStatus meta={query.data?.meta ?? null} /></div>
  </div>
}

function MarketPanel({ onSelect }: { onSelect: (symbol: string) => void }) {
  const [tab, setTab] = useState<'OVERVIEW' | 'SECURITIES'>('OVERVIEW')
  return <div className="flex h-full flex-col"><div className="flex border-b border-[var(--color-iron)] p-1"><button className="terminal-action" data-active={tab === 'OVERVIEW'} onClick={() => setTab('OVERVIEW')}>OVERVIEW</button><button className="terminal-action" data-active={tab === 'SECURITIES'} onClick={() => setTab('SECURITIES')}>SECURITIES</button></div><div className="min-h-0 flex-1">{tab === 'OVERVIEW' ? <MarketOverview onSelect={onSelect} /> : <SecurityDirectory onSelect={onSelect} />}</div></div>
}

function Watchlist({ userId, onSelect }: { userId: string | null; onSelect: (symbol: string) => void }) {
  const client = useMemo(() => userId ? createClient() : null, [userId])
  const queryClient = useQueryClient()
  const [symbol, setSymbol] = useState('')
  const [message, setMessage] = useState('')
  const lists = useQuery({ queryKey: ['watchlists', userId], enabled: Boolean(client), queryFn: async () => { const { data, error } = await client!.from('watchlists').select('id,name,is_default,watchlist_items(id,symbol,position)').order('position'); if (error) throw error; return data ?? [] } })
  const current = lists.data?.[0]
  const items = (current?.watchlist_items ?? []) as Array<{ id: string; symbol: string; position: number }>
  const quotes = useQueries({ queries: items.map((item) => ({ queryKey: ['stock', item.symbol], queryFn: () => stockQuery(item.symbol), retry: 0 })) })
  async function add() {
    if (!client || !userId) return
    const clean = symbol.trim().toUpperCase()
    if (!/^[A-Z0-9]{1,12}$/.test(clean)) { setMessage('Enter a valid ticker.'); return }
    let listId = current?.id
    if (!listId) { const { data, error } = await client.from('watchlists').insert({ name: 'My Watchlist', is_default: true }).select('id').single(); if (error) { setMessage(error.message); return } listId = data.id }
    const { error } = await client.from('watchlist_items').insert({ watchlist_id: listId, symbol: clean, position: items.length })
    if (error) setMessage(error.message); else { setSymbol(''); setMessage(''); queryClient.invalidateQueries({ queryKey: ['watchlists', userId] }) }
  }
  async function remove(id: string) { if (!client) return; const { error } = await client.from('watchlist_items').delete().eq('id', id); if (error) setMessage(error.message); else queryClient.invalidateQueries({ queryKey: ['watchlists', userId] }) }
  if (!client) return <PanelMessage state="UNAVAILABLE" detail="Sign in with a configured Supabase project to use watchlists." />
  return <div className="flex h-full flex-col">
    <form className="flex gap-1 border-b border-[var(--color-iron)] p-1" onSubmit={(event) => { event.preventDefault(); add() }}><input aria-label="Ticker to add" className="terminal-input min-w-0 flex-1" placeholder="ADD SYMBOL" value={symbol} onChange={(event) => setSymbol(event.target.value)} /><button className="terminal-action border border-[var(--color-slate)]" type="submit">ADD</button></form>
    {message && <div role="status" className="px-2 py-1 text-[var(--warning)]">{message}</div>}
    <div className="terminal-scroll min-h-0 flex-1 overflow-auto">
      {lists.isPending ? <PanelMessage state="LOADING" /> : lists.isError ? <PanelMessage state="ERROR" detail={lists.error.message} retry={() => lists.refetch()} /> : !items.length ? <PanelMessage state="EMPTY" detail="Add a ticker to your watchlist." /> : <table className="mono-table"><thead><tr><th>CODE</th><th className="numeric">LAST</th><th className="numeric">CHG</th><th className="numeric">VOLUME</th><th></th></tr></thead><tbody>{items.map((item, index) => { const quote = quotes[index].data?.data.quote; return <tr key={item.id}><td><button className="cyan" onClick={() => onSelect(item.symbol)}>{item.symbol}</button></td><td className="numeric">{formatNumber(quote?.close)}</td><td className={`numeric ${marketDirection(quote?.changePercent)}`}>{formatPercent(quote?.changePercent)}</td><td className="numeric">{formatCompact(quote?.volume)}</td><td><button aria-label={`Remove ${item.symbol}`} className="terminal-action" onClick={() => remove(item.id)}>×</button></td></tr> })}</tbody></table>}
    </div>
  </div>
}

function Portfolio({ userId }: { userId: string | null }) {
  const client = useMemo(() => userId ? createClient() : null, [userId])
  const queryClient = useQueryClient()
  const [symbol, setSymbol] = useState('')
  const [quantity, setQuantity] = useState('')
  const [price, setPrice] = useState('')
  const [kind, setKind] = useState<'BUY' | 'SELL'>('BUY')
  const [message, setMessage] = useState('')
  const portfolios = useQuery({ queryKey: ['portfolio', userId], enabled: Boolean(client), queryFn: async () => { const { data, error } = await client!.from('portfolios').select('id,name,portfolio_transactions(symbol,transaction_type,transaction_date,quantity,price,fees,cash_amount)').order('created_at'); if (error) throw error; return data ?? [] } })
  const current = portfolios.data?.[0]
  const transactions = useMemo(() => (current?.portfolio_transactions ?? []) as Transaction[], [current?.portfolio_transactions])
  const calculated = useMemo(() => { try { return calculatePortfolio(transactions) } catch { return null } }, [transactions])
  const activePositions = calculated?.positions.filter((position) => position.quantity > 0) ?? []
  const prices = useQueries({ queries: activePositions.map((position) => ({ queryKey: ['stock', position.symbol], queryFn: () => stockQuery(position.symbol), retry: 0 })) })
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (!client || !userId) return
    const ticker = symbol.trim().toUpperCase()
    const qty = Number(quantity), px = Number(price)
    if (!/^[A-Z0-9]{1,12}$/.test(ticker) || !Number.isFinite(qty) || qty <= 0 || !Number.isFinite(px) || px < 0) { setMessage('Check ticker, quantity, and price.'); return }
    let portfolioId = current?.id
    if (!portfolioId) { const { data, error } = await client.from('portfolios').insert({ name: 'Main Portfolio' }).select('id').single(); if (error) { setMessage(error.message); return } portfolioId = data.id }
    const { error } = await client.from('portfolio_transactions').insert({ portfolio_id: portfolioId, symbol: ticker, transaction_type: kind, transaction_date: new Date().toISOString().slice(0, 10), quantity: qty, price: px, fees: 0 })
    if (error) setMessage(error.message); else { setMessage('Recorded.'); setSymbol(''); setQuantity(''); setPrice(''); queryClient.invalidateQueries({ queryKey: ['portfolio', userId] }) }
  }
  if (!client) return <PanelMessage state="UNAVAILABLE" detail="Sign in with a configured Supabase project to track a portfolio." />
  return <div className="flex h-full flex-col">
    <form onSubmit={submit} className="flex flex-wrap gap-1 border-b border-[var(--color-iron)] p-1">
      <select aria-label="Transaction type" className="terminal-input" value={kind} onChange={(event) => setKind(event.target.value as 'BUY' | 'SELL')}><option>BUY</option><option>SELL</option></select>
      <input aria-label="Symbol" className="terminal-input w-20" placeholder="CODE" value={symbol} onChange={(event) => setSymbol(event.target.value)} />
      <input aria-label="Quantity" className="terminal-input w-24" placeholder="SHARES" inputMode="decimal" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
      <input aria-label="Price" className="terminal-input w-24" placeholder="PRICE" inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} />
      <button className="terminal-action border border-[var(--color-slate)]" type="submit">RECORD</button>
    </form>
    {message && <div role="status" className="p-1 text-[var(--color-fog)]">{message}</div>}
    <div className="terminal-scroll min-h-0 flex-1 overflow-auto">
      {portfolios.isPending ? <PanelMessage state="LOADING" /> : portfolios.isError ? <PanelMessage state="ERROR" detail={portfolios.error.message} retry={() => portfolios.refetch()} /> : !calculated ? <PanelMessage state="ERROR" detail="Transaction history contains an invalid position." /> : !transactions.length ? <PanelMessage state="EMPTY" detail="Record a transaction to begin tracking." /> : <><div className="flex gap-4 border-b border-[var(--color-iron)] p-2 text-[11px]"><span>CASH {formatNumber(calculated.cash)}</span><span>REALIZED P/L <span className={marketDirection(calculated.realizedPnL)}>{formatNumber(calculated.realizedPnL)}</span></span></div><table className="mono-table"><thead><tr><th>CODE</th><th className="numeric">QTY</th><th className="numeric">AVG COST</th><th className="numeric">LAST</th><th className="numeric">UNREALIZED</th></tr></thead><tbody>{activePositions.map((position, index) => { const last = prices[index].data?.data.quote.close ?? null; const pnl = last === null ? null : last * position.quantity - position.costBasis; return <tr key={position.symbol}><td className="cyan">{position.symbol}</td><td className="numeric">{formatNumber(position.quantity)}</td><td className="numeric">{formatNumber(position.averageCost)}</td><td className="numeric">{formatNumber(last)}</td><td className={`numeric ${marketDirection(pnl)}`}>{formatNumber(pnl)}</td></tr> })}</tbody></table></>}
    </div>
  </div>
}

function Help() { return <div className="p-2"><table className="mono-table"><thead><tr><th>COMMAND</th><th>ACTION</th><th>KEY</th></tr></thead><tbody>{Object.entries({ MARKET: 'Market overview', CHART: 'Price chart', BROKER: 'Broker flow', FOREIGN: 'Foreign flow', FUND: 'Fundamentals', PROFILE: 'Company profile', SCREENER: 'Screener', PORT: 'Portfolio', NEWS: 'News' }).map(([command, description], index) => <tr key={command}><td className="cyan">{command}</td><td>{description}</td><td className="muted">F{index + 2}</td></tr>)}</tbody></table><p className="p-2 text-[var(--color-ash)]">SYMBOL then FUNCTION: BBCA CHART · / command · Ctrl/Cmd K palette · Alt 1–9 panels</p></div> }

export function MarketPanelContent({ type, symbol, userId, onSelect }: { type: PanelType; symbol: string | null; userId: string | null; onSelect: (symbol: string) => void }) {
  if (type === 'CHART' || type === 'FOREIGN' || type === 'BROKER' || type === 'ANN') return <StockResearch symbol={symbol} type={type} />
  if (type === 'FUND' || type === 'PROFILE' || type === 'OWNERSHIP' || type === 'CORP') {
    if (!symbol) return <PanelMessage state="EMPTY" detail="Select a security with the command bar." />
    return type === 'FUND' ? <FundamentalsPanel symbol={symbol} /> : type === 'CORP' ? <ActionsPanel symbol={symbol} /> : <ProfilePanel symbol={symbol} ownership={type === 'OWNERSHIP'} />
  }
  if (type === 'MARKET') return <MarketPanel onSelect={onSelect} />
  if (type === 'SCREENER') return <ScreenerPanel userId={userId} onSelect={onSelect} />
  if (type === 'WL') return <Watchlist userId={userId} onSelect={onSelect} />
  if (type === 'PORT') return <Portfolio userId={userId} />
  if (type === 'ALERTS') return <AlertsPanel userId={userId} symbol={symbol} />
  if (type === 'SIGNALS') return <SignalsPanel onSelect={onSelect} />
  if (type === 'NEWS') return <PanelMessage state="UNAVAILABLE" detail="The configured idx-bei API has no verified news contract." />
  return <Help />
}
