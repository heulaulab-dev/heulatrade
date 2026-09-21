import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'

const commands = ['BBCA', 'BBCA CHART', 'BBCA BROKER', 'BBCA BACC', 'BBCA TAPE', 'BBCA FUND', 'BBCA INSIDER', 'BBCA SEASONAL', 'SCREENER', 'MKTCAP']
const workspace = ['CHART', 'SEASONALITY', 'QUOTE', 'TAPE', 'BROKER', 'ANALYSIS', 'INSIDER', 'HISTORY', 'FINANCIALS']
const freshness = ['LIVE', 'DELAYED', 'EOD', 'HISTORICAL', 'STALE', 'UNAVAILABLE']
const stack = ['PRICE', 'TECHNICAL', 'FLOW', 'SEASONALITY', 'FUNDAMENTALS', 'INSIDER', 'HISTORICAL PATTERN']

const brokerRows = [
  ['YP', 'BUY', '49.8B', 'ACCUM'],
  ['AK', 'BUY', '28.4B', 'ACCUM'],
  ['CC', 'SELL', '-19.7B', 'DIST'],
  ['RX', 'SELL', '-12.2B', 'DIST'],
]

const tapeRows = [
  ['09:32:14', 'BUY', '9,425', '1,200', 'YP', 'CC'],
  ['09:32:10', 'SELL', '9,400', '820', 'AK', 'PD'],
  ['09:31:58', 'BUY', '9,425', '540', 'NI', 'RX'],
  ['09:31:44', 'BUY', '9,400', '310', 'YP', 'XC'],
]

const screenerRows = [
  ['BBCA', 'BANK CENTRAL ASIA', 'FLOW+', 'EOD'],
  ['TLKM', 'TELKOM INDONESIA', 'VALUE', 'EOD'],
  ['ASII', 'ASTRA INTERNATIONAL', 'SEASONAL', 'HIST'],
  ['BBRI', 'BANK RAKYAT INDONESIA', 'FOREIGN', 'EOD'],
]

async function terminalHref() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) return '/login'
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  return data?.claims?.sub ? '/terminal' : '/login'
}

function MiniBars() {
  const heights = [18, 26, 22, 34, 30, 44, 38, 52, 46, 35, 42, 31, 28, 37, 24, 40]
  return <div className="landing-bars" aria-label="Preview price activity">{heights.map((height, index) => <span key={`${height}-${index}`} style={{ height }} />)}</div>
}

function MiniTable({ rows, headers }: { rows: string[][]; headers: string[] }) {
  return <table className="mono-table landing-table">
    <thead><tr>{headers.map((header) => <th key={header} className={header === headers[0] ? '' : 'numeric'}>{header}</th>)}</tr></thead>
    <tbody>{rows.map((row) => <tr key={row.join('-')}>{row.map((cell, index) => <td key={`${cell}-${index}`} className={index === 0 ? '' : 'numeric'}>{cell}</td>)}</tr>)}</tbody>
  </table>
}

function TerminalPreview() {
  return <section className="terminal-panel landing-preview" aria-label="Sample terminal preview">
    <header className="terminal-panel-header">
      <div className="flex min-w-0 items-center gap-2">
        <strong className="text-[11px]">BBCA</strong>
        <span className="cyan text-[11px]">SAMPLE / PREVIEW</span>
      </div>
      <span className="text-[10px] text-[var(--color-ash)]">IDX · EOD</span>
    </header>
    <div className="grid gap-px bg-[var(--color-iron)] md:grid-cols-[1.15fr_.85fr]">
      <div className="bg-[var(--color-carbon)] p-3">
        <div className="mb-3 grid grid-cols-3 gap-px bg-[var(--color-iron)] text-[10px]">
          {['LAST 9,425', 'CHG +1.34%', 'VALUE 812.4B'].map((item) => <div key={item} className="bg-[var(--color-graphite)] p-2">{item}</div>)}
        </div>
        <MiniBars />
        <div className="mt-3 grid grid-cols-7 gap-px text-center text-[9px] text-[var(--color-ash)]">{['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL'].map((month) => <span key={month} className="bg-[var(--color-graphite)] py-1">{month}</span>)}</div>
      </div>
      <div className="grid gap-px bg-[var(--color-iron)]">
        <div className="bg-[var(--color-carbon)] p-3"><MiniTable headers={['BROKER', 'SIDE', 'NET', 'MODE']} rows={brokerRows.slice(0, 3)} /></div>
        <div className="bg-[var(--color-carbon)] p-3"><MiniTable headers={['TIME', 'AGG', 'PX', 'LOT']} rows={tapeRows.slice(0, 3).map(([time, agg, px, lot]) => [time, agg, px, lot])} /></div>
      </div>
    </div>
  </section>
}

function FlowModule({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="terminal-panel">
    <header className="terminal-panel-header"><strong className="text-[11px]">{title}</strong><span className="text-[10px] text-[var(--color-ash)]">PREVIEW</span></header>
    <div className="terminal-panel-body p-3">{children}</div>
  </section>
}

export default async function Home() {
  const openTerminalHref = await terminalHref()
  return <main className="landing-shell">
    <header className="landing-nav">
      <Link href="/" className="text-[13px] font-bold tracking-tight">HEULA<span className="text-[var(--color-ember)]">/</span>TRADE</Link>
      <nav aria-label="Landing sections" className="hidden items-center gap-5 text-[11px] text-[var(--color-fog)] md:flex">
        <a href="#product">PRODUCT</a><a href="#data">MARKET DATA</a><a href="#workflow">WORKFLOW</a><a href="#about">ABOUT</a>
      </nav>
      <div className="ml-auto flex items-center gap-2">
        <Link href="/login" className="terminal-action">LOG IN</Link>
        <Button asChild size="sm"><Link href={openTerminalHref}>OPEN TERMINAL</Link></Button>
      </div>
    </header>

    <section className="landing-hero">
      <div className="landing-copy">
        <p className="landing-kicker">HEULATRADE<br />MARKET INTELLIGENCE TERMINAL</p>
        <h1>Read the market.<br />Follow the flow.</h1>
        <p>A research workspace for Indonesian equities: price action, broker behavior, foreign flow, seasonality, fundamentals, insider activity, and order flow.</p>
        <div className="flex flex-wrap gap-2">
          <Button asChild><Link href={openTerminalHref}>OPEN TERMINAL</Link></Button>
          <Button asChild variant="outline"><a href="#workflow">EXPLORE WORKFLOW</a></Button>
        </div>
      </div>
      <TerminalPreview />
    </section>

    <section id="product" className="landing-section">
      <h2>One stock.<br />One research workspace.</h2>
      <p>Select a symbol and the workspace becomes a full research view. Lock panels when you need another comparison context.</p>
      <div className="workspace-map" aria-label="Security workspace panels">{workspace.map((item, index) => <div key={item} className={index === 0 ? 'wide' : ''}><span>{item}</span><small>{index === 0 ? 'BBCA SAMPLE' : 'PANEL'}</small></div>)}</div>
    </section>

    <section id="data" className="landing-section">
      <h2>Read the flow.</h2>
      <div className="flow-grid">
        <FlowModule title="BROKER FLOW"><MiniTable headers={['BROKER', 'SIDE', 'NET', 'MODE']} rows={brokerRows} /></FlowModule>
        <FlowModule title="FOREIGN FLOW"><dl className="flow-list"><div><dt>FOREIGN BUY</dt><dd>184.2B</dd></div><div><dt>FOREIGN SELL</dt><dd>151.8B</dd></div><div><dt>NET FOREIGN</dt><dd className="positive">+32.4B</dd></div></dl></FlowModule>
        <FlowModule title="ORDER FLOW"><MiniTable headers={['TIME', 'AGG', 'PRICE', 'LOT', 'BUYER', 'SELLER']} rows={tapeRows} /></FlowModule>
      </div>
    </section>

    <section className="landing-section process-section">
      <h2>From price to context.</h2>
      <div className="process-line">{stack.map((item) => <span key={item}>{item}</span>)}</div>
      <p>Price tells you what moved. Flow shows who participated. History shows how similar conditions behaved before.</p>
    </section>

    <section id="workflow" className="landing-section command-section">
      <h2>Command driven.</h2>
      <div className="command-console" aria-label="Command examples">
        <div><span>›</span><strong className="command-type">BBCA CHART</strong><i /></div>
        <div className="command-grid">{commands.map((command) => <code key={command}>{command}</code>)}</div>
      </div>
      <p>Type a security. Run a function. Keep context across unlocked panels with global symbol, panel locking, resizable workspace, and focused commands.</p>
    </section>

    <section className="landing-section discovery-section">
      <h2>Market discovery without recommendations.</h2>
      <div className="terminal-panel">
        <header className="terminal-panel-header"><strong>SCREENER / MARKET CAP / SEARCH</strong><span className="text-[10px] text-[var(--color-ash)]">PREVIEW</span></header>
        <MiniTable headers={['CODE', 'NAME', 'SIGNAL', 'FRESH']} rows={screenerRows} />
      </div>
    </section>

    <section id="about" className="landing-section trust-section">
      <h2>Know what you are looking at.</h2>
      <div className="freshness-grid">{freshness.map((item) => <span key={item}>{item}</span>)}</div>
      <p>HeulaTrade does not label data as live unless the underlying source is actually realtime. Unavailable data stays unavailable, missing values are not converted to zero, and provider-derived analysis is labeled separately from raw market facts.</p>
    </section>

    <section className="final-strip">
      <span>READY&gt;</span>
      <strong>Read the market.<br />Follow the flow.</strong>
      <Button asChild><Link href={openTerminalHref}>OPEN TERMINAL</Link></Button>
    </section>

    <footer className="landing-footer">
      <div><strong>HeulaTrade</strong><br /><span>Market Intelligence Terminal</span></div>
      <nav aria-label="Footer"><Link href="/terminal">Terminal</Link><Link href="/login">Login</Link><a href="#privacy">Privacy</a><a href="#terms">Terms</a></nav>
      <p>Market intelligence and research tools only. Not investment advice and not an order execution platform.</p>
    </footer>
  </main>
}
