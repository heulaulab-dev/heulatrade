'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, ChevronsUpDown, Columns2, LockKeyhole, LockKeyholeOpen, Maximize2, Minimize2, PanelTop, RefreshCw, Split, X } from 'lucide-react'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { Providers } from './providers'
import { MarketPanelContent } from '@/components/panels/market-panels'
import { listPanels, findPanel, useTerminalStore, type LayoutNode, type Panel } from '@/stores/terminal-store'
import { parseCommand, registry, symbolPanels, type CommandName, type PanelType } from '@/lib/commands/registry'
import { LayoutSchema, sameJson } from '@/lib/workspace-schema'
import { createClient } from '@/lib/supabase/client'
import { securitiesQuery } from '@/lib/api/client'

const functionKeys: CommandName[] = ['HELP', 'MARKET', 'CHART', 'BROKER', 'FOREIGN', 'FUND', 'PROFILE', 'SCREENER', 'PORT', 'NEWS']

function useMarketSocket() {
  const [state, setState] = useState<'OFFLINE' | 'CONNECTING' | 'RECONNECTING' | 'CONNECTED'>('OFFLINE')
  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_MARKET_WS_URL
    if (!url) return
    let socket: WebSocket | null = null
    let timeout: ReturnType<typeof setTimeout> | null = null
    let attempt = 0
    let closed = false
    function connect() {
      if (closed) return
      setState(attempt ? 'RECONNECTING' : 'CONNECTING')
      socket = new WebSocket(url!)
      socket.onopen = () => { attempt = 0; setState('CONNECTED') }
      socket.onclose = () => { if (closed) return; setState('RECONNECTING'); attempt += 1; timeout = setTimeout(connect, Math.min(30_000, 500 * 2 ** attempt) + Math.random() * 400) }
      socket.onerror = () => socket?.close()
    }
    connect()
    return () => { closed = true; if (timeout) clearTimeout(timeout); socket?.close() }
  }, [])
  return state
}

function PanelView({ panel, userId }: { panel: Panel; userId: string | null }) {
  const store = useTerminalStore()
  const queryClient = useQueryClient()
  const currentSymbol = symbolPanels.has(panel.type) ? panel.locked ? panel.symbol : store.activeSymbol : null
  return <section id={`terminal-panel-${panel.id}`} className="terminal-panel h-full" aria-label={`${panel.type} panel`} tabIndex={-1} onFocus={() => store.setFocused(panel.id)}>
    <header className="terminal-panel-header">
      <div className="flex min-w-0 items-center gap-2"><span className="truncate text-[11px] font-bold">{panel.type}</span>{currentSymbol && <span className="cyan text-[11px]">{currentSymbol}</span>}{panel.locked && <LockKeyhole aria-label="Symbol locked" className="size-3 text-[var(--color-ash)]" />}</div>
      <div className="flex items-center gap-0.5">
        <button className="terminal-action" aria-label="Refresh panel" title="Refresh" onClick={() => queryClient.invalidateQueries()}><RefreshCw className="size-3" /></button>
        {symbolPanels.has(panel.type) && <button className="terminal-action" aria-label={panel.locked ? 'Unlock symbol' : 'Lock symbol'} title={panel.locked ? 'Unlock symbol' : 'Lock symbol'} onClick={() => store.toggleLock(panel.id)}>{panel.locked ? <LockKeyholeOpen className="size-3" /> : <LockKeyhole className="size-3" />}</button>}
        <button className="terminal-action" aria-label={store.maximizedPanel === panel.id ? 'Restore panel' : 'Maximize panel'} onClick={() => store.toggleMaximize(panel.id)}>{store.maximizedPanel === panel.id ? <Minimize2 className="size-3" /> : <Maximize2 className="size-3" />}</button>
        <DropdownMenu><DropdownMenuTrigger asChild><button className="terminal-action" aria-label="Panel actions"><ChevronsUpDown className="size-3" /></button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuGroup>
          <DropdownMenuItem onSelect={() => store.splitPanel(panel.id, 'horizontal')}><Columns2 /> Split right</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => store.splitPanel(panel.id, 'vertical')}><Split /> Split below</DropdownMenuItem>
          {Object.keys(registry).filter((key) => key !== 'HELP').map((key) => <DropdownMenuItem key={key} onSelect={() => store.replacePanel(panel.id, key as PanelType)}><PanelTop /> Replace with {key}</DropdownMenuItem>)}
          <DropdownMenuItem onSelect={() => store.closePanel(panel.id)}><X /> Close panel</DropdownMenuItem>
        </DropdownMenuGroup></DropdownMenuContent></DropdownMenu>
      </div>
    </header>
    <div className="terminal-panel-body terminal-scroll"><MarketPanelContent type={panel.type} symbol={currentSymbol} userId={userId} onSelect={store.setSymbol} /></div>
  </section>
}

function WorkspaceNode({ node, userId }: { node: LayoutNode; userId: string | null }) {
  const setSplitSizes = useTerminalStore((state) => state.setSplitSizes)
  if (node.kind === 'panel') return <PanelView panel={node.panel} userId={userId} />
  return <ResizablePanelGroup direction={node.direction} className="h-full min-h-0 min-w-0" onLayout={(sizes) => { if (sizes.length === 2 && sizes.every((size) => Number.isFinite(size) && size >= 15 && size <= 85)) setSplitSizes(node.id, [sizes[0], sizes[1]]) }}>
    <ResizablePanel defaultSize={node.sizes?.[0] ?? 50} minSize={15} className="min-h-0 min-w-0"><WorkspaceNode node={node.children[0]} userId={userId} /></ResizablePanel>
    <ResizableHandle className="bg-[var(--color-void)]" />
    <ResizablePanel defaultSize={node.sizes?.[1] ?? 50} minSize={15} className="min-h-0 min-w-0"><WorkspaceNode node={node.children[1]} userId={userId} /></ResizablePanel>
  </ResizablePanelGroup>
}

function TerminalInner({ userId, configurationMissing }: { userId: string | null; configurationMissing?: boolean }) {
  const store = useTerminalStore()
  const [input, setInput] = useState('')
  const [palette, setPalette] = useState(false)
  const [workspaceName, setWorkspaceName] = useState<string | null>(null)
  const workspaceId = useRef<string | null>(null)
  const readyToPersist = useRef(false)
  const [saveMessage, setSaveMessage] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const socketState = useMarketSocket()
  const queryClient = useQueryClient()
  const supabase = useMemo(() => userId ? createClient() : null, [userId])
  const workspaceQuery = useQuery({ queryKey: ['workspaces', userId], enabled: Boolean(supabase), queryFn: async () => { const { data, error } = await supabase!.from('workspaces').select('id,name,layout,is_default,updated_at').order('updated_at', { ascending: false }); if (error) throw error; if (data?.some((row) => !LayoutSchema.safeParse(row.layout).success)) throw new Error('Saved workspace layout is invalid'); return data ?? [] } })
  const securitySearch = useQuery({ queryKey: ['palette-securities', input], queryFn: () => securitiesQuery(input), enabled: palette && input.trim().length >= 2 && !input.includes(' '), staleTime: 60_000 })
  useEffect(() => {
    if (!supabase || !userId) return
    const channel = supabase.channel(`user-data:${userId}`)
    for (const [table, key] of [['watchlists', 'watchlists'], ['watchlist_items', 'watchlists'], ['workspaces', 'workspaces'], ['portfolios', 'portfolio'], ['portfolio_transactions', 'portfolio'], ['alerts', 'alerts'], ['notifications', 'notifications'], ['saved_screeners', 'saved-screeners']] as const) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => queryClient.invalidateQueries({ queryKey: [key, userId] }))
    }
    channel.subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [supabase, userId, queryClient])
  const loaded = useRef(false)
  useEffect(() => {
    if (loaded.current || !workspaceQuery.data) return
    loaded.current = true
    const saved = workspaceQuery.data.find((row) => row.is_default) ?? workspaceQuery.data[0]
    if (saved) {
      const parsed = LayoutSchema.safeParse(saved.layout)
      if (parsed.success) {
        store.restore(parsed.data as LayoutNode)
        workspaceId.current = saved.id
      }
    }
    readyToPersist.current = true
  }, [workspaceQuery.data, store])
  useEffect(() => {
    if (!supabase || !userId || !workspaceId.current || !readyToPersist.current) return
    const activeId = workspaceId.current
    const saved = workspaceQuery.data?.find((row) => row.id === activeId)
    if (!saved || sameJson(saved.layout, store.layout)) return
    const timeout = setTimeout(async () => {
      const { error } = await supabase.from('workspaces').update({ layout: store.layout }).eq('id', activeId)
      if (error) setSaveMessage(error.message)
      else {
        setSaveMessage('SAVED')
        void queryClient.invalidateQueries({ queryKey: ['workspaces', userId] })
      }
    }, 700)
    return () => clearTimeout(timeout)
  }, [supabase, userId, workspaceQuery.data, store.layout, queryClient])
  function execute(value: string) {
    const parsed = parseCommand(value, store.activeSymbol)
    if (parsed.type === 'error') { store.setCommandError(`${parsed.message}${parsed.suggestions.length ? ` · TRY ${parsed.suggestions.join(', ')}` : ''}`); return }
    store.setCommandError(null)
    if (parsed.type === 'symbol') store.setSymbol(parsed.symbol)
    else if (parsed.command === 'HELP') { setInput(''); setPalette(true); return }
    else { if (parsed.symbol && parsed.symbol !== store.activeSymbol) store.setSymbol(parsed.symbol); store.openPanel(parsed.command as PanelType, parsed.symbol) }
    setInput(''); setPalette(false)
  }
  useEffect(() => {
    function keydown(event: KeyboardEvent) {
      const target = event.target as HTMLElement
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setPalette(true) }
      else if (event.key === '/' && !typing) { event.preventDefault(); inputRef.current?.focus() }
      else if (event.key === 'Escape') { setPalette(false); store.setCommandError(null); inputRef.current?.blur() }
      else if (event.altKey && /^[1-9]$/.test(event.key)) { event.preventDefault(); const p = listPanels(store.layout)[Number(event.key) - 1]; if (p) document.getElementById(`terminal-panel-${p.id}`)?.focus() }
      else if (/^F([1-9]|10)$/.test(event.key)) { const index = Number(event.key.slice(1)) - 1; if (functionKeys[index]) { event.preventDefault(); execute(functionKeys[index]) } }
    }
    window.addEventListener('keydown', keydown)
    return () => window.removeEventListener('keydown', keydown)
  })
  async function saveWorkspace() {
    if (!supabase || !userId) { setSaveMessage('Sign in to save workspaces.'); return }
    const name = (workspaceName ?? workspaceQuery.data?.find((row) => row.is_default)?.name ?? '').trim() || 'Research Workspace'
    const { data, error } = await supabase.rpc('save_workspace', { p_name: name, p_layout: store.layout })
    if (error) setSaveMessage(error.message)
    else { setSaveMessage('SAVED'); setWorkspaceName(name); workspaceId.current = data; queryClient.invalidateQueries({ queryKey: ['workspaces', userId] }) }
  }
  async function signOut() {
    if (!supabase) return
    const { error } = await supabase.auth.signOut()
    if (error) { setSaveMessage(error.message); return }
    location.href = '/login'
  }
  const shown = store.maximizedPanel ? findPanel(store.layout, store.maximizedPanel) : null
  const panels = listPanels(store.layout)
  return <main className="flex h-dvh min-h-0 flex-col overflow-hidden bg-black text-[var(--color-paper)]">
    <header className="flex min-h-11 items-center gap-3 border-b border-[var(--color-iron)] px-3">
      <div className="shrink-0 text-[13px] font-bold tracking-tight">HEULA<span className="text-[var(--color-ember)]">/</span>TRADE</div>
      <form className="flex min-w-0 flex-1 items-center" onSubmit={(event) => { event.preventDefault(); execute(input) }}><span className="mr-2 text-[var(--color-ember)]">›</span><input ref={inputRef} aria-label="Terminal command" className="h-8 min-w-0 w-full max-w-xl border border-[var(--color-slate)] bg-[var(--color-carbon)] px-2 text-[12px] outline-none focus:border-[var(--color-ember)]" value={input} onChange={(event) => setInput(event.target.value)} placeholder="BBCA CHART  /  MARKET  /  SCREENER" autoComplete="off" /><button className="ml-1 border border-[var(--color-slate)] px-2 py-1 text-[10px] hover:bg-[var(--color-graphite)]" type="submit">GO ↵</button></form>
      <div className="hidden shrink-0 items-center gap-3 text-[10px] sm:flex"><span className="text-[var(--color-ash)]">{socketState === 'CONNECTED' ? '● FEED CONNECTED' : `○ ${socketState}`}</span><button className="terminal-action" onClick={() => setPalette(true)}>⌘K</button><button className="terminal-action" aria-label="Notifications" onClick={() => execute('ALERTS')}><Bell className="size-3" /></button>{userId && <button className="terminal-action" onClick={signOut}>SIGN OUT</button>}</div>
    </header>
    <nav aria-label="Functions" className="terminal-scroll flex min-h-8 items-center overflow-x-auto border-b border-[var(--color-iron)] px-2">{functionKeys.map((command) => <button key={command} className="terminal-action shrink-0 text-[10px]" onClick={() => execute(command)}><span className="mr-1 text-[var(--color-steel)]">{registry[command].shortcut}</span>{command}</button>)}</nav>
    <div className="flex min-h-8 items-center gap-4 overflow-hidden border-b border-[var(--color-iron)] bg-[var(--color-carbon)] px-3 text-[10px]"><span className="shrink-0 text-[var(--color-ash)]">GLOBAL</span><strong className="cyan">{store.activeSymbol ?? 'NO SECURITY'}</strong><span className="text-[var(--color-steel)]">IDX · WIB</span><span className="ml-auto truncate text-[var(--color-ash)]">{configurationMissing ? 'SUPABASE NOT CONFIGURED' : saveMessage || store.commandError || 'READ THE MARKET. FOLLOW THE FLOW.'}</span></div>
    <div className="flex min-h-8 items-center gap-2 border-b border-[var(--color-iron)] px-2 text-[10px]"><span className="text-[var(--color-ash)]">WORKSPACE</span><input aria-label="Workspace name" className="h-6 w-40 border border-[var(--color-slate)] bg-[var(--color-carbon)] px-2" value={workspaceName ?? workspaceQuery.data?.find((row) => row.is_default)?.name ?? ''} onChange={(event) => setWorkspaceName(event.target.value)} placeholder="Research Workspace" /><button className="terminal-action border border-[var(--color-slate)]" onClick={saveWorkspace}>SAVE</button><select aria-label="Load workspace" className="h-6 max-w-48 border border-[var(--color-slate)] bg-[var(--color-carbon)] text-[10px]" value="" onChange={(event) => { const row = workspaceQuery.data?.find((w) => w.id === event.target.value); const parsed = LayoutSchema.safeParse(row?.layout); if (row && parsed.success) { workspaceId.current = row.id; store.restore(parsed.data as LayoutNode); setWorkspaceName(row.name) } }}><option value="">LOAD WORKSPACE</option>{workspaceQuery.data?.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select>{workspaceQuery.isError && <button className="text-[var(--warning)]" onClick={() => workspaceQuery.refetch()}>WORKSPACE LOAD FAILED · RETRY</button>}<span className="ml-auto hidden text-[var(--color-steel)] md:block">/ COMMAND · ALT 1–9 PANEL · F1 HELP</span></div>
    <div className="hidden min-h-0 flex-1 p-[2px] sm:block">{shown ? <PanelView panel={shown} userId={userId} /> : <WorkspaceNode node={store.layout} userId={userId} />}</div>
    <div className="flex min-h-0 flex-1 flex-col p-[2px] sm:hidden"><select aria-label="Mobile panel" className="terminal-input mb-1" value={store.focusedPanel ?? panels[0]?.id} onChange={(event) => store.setFocused(event.target.value)}>{panels.map((panel) => <option key={panel.id} value={panel.id}>{panel.type} {panel.symbol ?? ''}</option>)}</select>{panels.map((panel) => panel.id === (store.focusedPanel ?? panels[0]?.id) ? <PanelView key={panel.id} panel={panel} userId={userId} /> : null)}</div>
    <footer className="flex min-h-6 items-center justify-between border-t border-[var(--color-iron)] px-2 text-[10px] text-[var(--color-steel)]"><span>HEULATRADE / IDX INTELLIGENCE TERMINAL</span><span>RESEARCH ONLY · DATA FRESHNESS SHOWN PER PANEL</span></footer>
    <Dialog open={palette} onOpenChange={setPalette}><DialogContent className="max-w-xl rounded-[2px] border-[var(--color-slate)] bg-[var(--color-carbon)] p-0 shadow-none"><DialogTitle className="sr-only">Command palette</DialogTitle><Command className="rounded-[2px]" shouldFilter={false}><CommandInput placeholder="Search function, company, or enter command" onKeyDown={(event) => { if (event.key === 'Enter' && input.trim() && !securitySearch.data?.data.length) execute(input) }} onValueChange={setInput} /><CommandList><CommandEmpty>No command found.</CommandEmpty><CommandGroup heading="FUNCTIONS">{Object.entries(registry).filter(([name, value]) => !input || name.toLowerCase().includes(input.toLowerCase()) || value.description.toLowerCase().includes(input.toLowerCase())).map(([name, value]) => <CommandItem key={name} value={name} onSelect={() => execute(name)}><span className="w-20 text-[var(--color-ember)]">{name}</span><span className="text-[var(--color-fog)]">{value.description}</span><span className="ml-auto text-[var(--color-steel)]">{value.shortcut}</span></CommandItem>)}</CommandGroup>{Boolean(securitySearch.data?.data.length) && <CommandGroup heading="SECURITIES">{securitySearch.data?.data.slice(0, 12).map((security) => <CommandItem key={security.symbol} value={security.symbol} onSelect={() => { store.setSymbol(security.symbol); setPalette(false); setInput('') }}><span className="w-20 text-[var(--terminal-cyan)]">{security.symbol}</span><span className="text-[var(--color-fog)]">{security.companyName}</span></CommandItem>)}</CommandGroup>}{Boolean(workspaceQuery.data?.length) && <CommandGroup heading="WORKSPACES">{workspaceQuery.data?.filter((row) => !input || row.name.toLowerCase().includes(input.toLowerCase())).map((row) => <CommandItem key={row.id} value={row.name} onSelect={() => { const parsed = LayoutSchema.safeParse(row.layout); if (parsed.success) { store.restore(parsed.data as LayoutNode); setWorkspaceName(row.name); setPalette(false) } }}>{row.name}</CommandItem>)}</CommandGroup>}</CommandList></Command></DialogContent></Dialog>
  </main>
}

export function Terminal(props: { userId: string | null; configurationMissing?: boolean }) { return <Providers><TerminalInner {...props} /></Providers> }
