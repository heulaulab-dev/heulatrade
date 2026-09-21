export const registry = {
  HELP: { aliases: ['?'], requiresSymbol: false, description: 'Command reference', shortcut: 'F1' },
  MARKET: { aliases: ['MKT', 'MOVERS'], requiresSymbol: false, description: 'Market overview', shortcut: 'F2' },
  CHART: { aliases: ['GP', 'GRAPH'], requiresSymbol: true, description: 'Price and volume', shortcut: 'F3' },
  QUOTE: { aliases: ['SNAPSHOT'], requiresSymbol: true, description: 'Security quote snapshot', shortcut: '' },
  HISTORY: { aliases: ['HIST'], requiresSymbol: true, description: 'Historical price table', shortcut: '' },
  BROKER: { aliases: ['BRKR', 'FLOW'], requiresSymbol: true, description: 'Broker flow', shortcut: 'F4' },
  BACC: { aliases: ['BROKERACC'], requiresSymbol: true, description: 'Broker accumulation', shortcut: '' },
  TAPE: { aliases: ['DONE'], requiresSymbol: true, description: 'Live and historical tape', shortcut: '' },
  FOREIGN: { aliases: ['FRGN'], requiresSymbol: true, description: 'Foreign flow', shortcut: 'F5' },
  FUND: { aliases: ['FA', 'FUNDAMENTAL'], requiresSymbol: true, description: 'Fundamentals', shortcut: 'F6' },
  INSIDER: { aliases: ['INSIDERS'], requiresSymbol: true, description: 'Insider transactions', shortcut: '' },
  SEASONAL: { aliases: ['SEASONALITY'], requiresSymbol: true, description: 'Seasonality matrix', shortcut: '' },
  ANALYSIS: { aliases: ['ANALYZE'], requiresSymbol: true, description: 'Provider analysis', shortcut: '' },
  PROFILE: { aliases: ['COMPANY'], requiresSymbol: true, description: 'Company profile', shortcut: 'F7' },
  SCREENER: { aliases: ['SCREEN'], requiresSymbol: false, description: 'Security screener', shortcut: 'F8' },
  MKTCAP: { aliases: ['MARKETCAP'], requiresSymbol: false, description: 'Market capitalization', shortcut: '' },
  LIVE: { aliases: [], requiresSymbol: false, description: 'Live market activity', shortcut: '' },
  PORT: { aliases: ['PORTFOLIO'], requiresSymbol: false, description: 'Portfolio tracker', shortcut: 'F9' },
  NEWS: { aliases: [], requiresSymbol: false, description: 'News headlines', shortcut: 'F10' },
  WL: { aliases: ['WATCHLIST'], requiresSymbol: false, description: 'Watchlists', shortcut: '' },
  ANN: { aliases: ['ANNOUNCEMENTS'], requiresSymbol: true, description: 'IDX disclosures', shortcut: '' },
  CORP: { aliases: ['ACTIONS'], requiresSymbol: true, description: 'Corporate actions', shortcut: '' },
  OWNERSHIP: { aliases: ['OWN'], requiresSymbol: true, description: 'Ownership', shortcut: '' },
  ALERTS: { aliases: ['ALERT'], requiresSymbol: false, description: 'Alerts and notifications', shortcut: '' },
  SIGNALS: { aliases: ['SIGNAL'], requiresSymbol: false, description: 'Quantitative signals', shortcut: '' },
} as const

export type CommandName = keyof typeof registry
export type PanelType = Exclude<CommandName, 'HELP'>
export const symbolPanels = new Set<PanelType>(['CHART', 'QUOTE', 'HISTORY', 'BROKER', 'BACC', 'TAPE', 'FOREIGN', 'FUND', 'INSIDER', 'SEASONAL', 'ANALYSIS', 'PROFILE', 'OWNERSHIP', 'CORP', 'ANN', 'NEWS'])

const lookup = Object.entries(registry).flatMap(([name, value]) =>
  [name, ...value.aliases].map((alias) => [alias, name as CommandName] as const),
)
const aliases = new Map<string, CommandName>(lookup)

export type ParsedCommand = { type: 'execute'; command: CommandName; symbol: string | null }
  | { type: 'symbol'; symbol: string }
  | { type: 'error'; message: string; suggestions: string[] }

export function parseCommand(input: string, currentSymbol: string | null): ParsedCommand {
  const tokens = input.trim().toUpperCase().replace(/\s*<GO>\s*$/, '').split(/\s+/).filter(Boolean)
  if (!tokens.length) return { type: 'error', message: 'Enter a symbol or function', suggestions: ['MARKET', 'HELP'] }
  if (tokens.length === 1 && /^[A-Z0-9]{1,12}$/.test(tokens[0]) && !aliases.has(tokens[0])) {
    return { type: 'symbol', symbol: tokens[0] }
  }
  const first = aliases.get(tokens[0])
  const command = first ?? aliases.get(tokens[1])
  const symbol = first ? currentSymbol : tokens[0]
  if (!command || tokens.length > 2 || (!first && !/^[A-Z0-9]{1,12}$/.test(tokens[0]))) {
    const prefix = tokens.at(-1) ?? ''
    return { type: 'error', message: `Unknown command: ${input.trim()}`, suggestions: Object.keys(registry).filter((key) => key.startsWith(prefix)).slice(0, 4) }
  }
  if (registry[command].requiresSymbol && !symbol) {
    return { type: 'error', message: `${command} requires a security`, suggestions: [`BBCA ${command}`] }
  }
  return { type: 'execute', command, symbol }
}
