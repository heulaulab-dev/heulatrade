import { describe, expect, it } from 'vitest'
import { parseCommand } from '@/lib/commands/registry'
import { useTerminalStore, listPanels } from '@/stores/terminal-store'

describe('terminal commands', () => {
  it('parses symbol and alias commands', () => {
    expect(parseCommand('BBCA', null)).toEqual({ type: 'symbol', symbol: 'BBCA' })
    expect(parseCommand('bbca gp', null)).toEqual({ type: 'execute', command: 'CHART', symbol: 'BBCA' })
    expect(parseCommand('FRGN', 'BBRI')).toEqual({ type: 'execute', command: 'FOREIGN', symbol: 'BBRI' })
  })
  it('requires a symbol and suggests a valid command', () => {
    expect(parseCommand('CHART', null)).toMatchObject({ type: 'error', suggestions: ['BBCA CHART'] })
    expect(parseCommand('BBCA MARKE', null)).toMatchObject({ type: 'error', suggestions: ['MARKET'] })
  })
  it('parses all provider terminal functions', () => {
    for (const command of ['CHART', 'BROKER', 'BACC', 'TAPE', 'FUND', 'INSIDER', 'SEASONAL', 'ANALYSIS']) {
      expect(parseCommand(`BBCA ${command}`, null)).toMatchObject({ type: 'execute', command, symbol: 'BBCA' })
    }
    expect(parseCommand('MKTCAP', 'BBCA')).toMatchObject({ type: 'execute', command: 'MKTCAP' })
    expect(parseCommand('LIVE', 'BBCA')).toMatchObject({ type: 'execute', command: 'LIVE' })
  })
  it('keeps a locked panel on its symbol', () => {
    const store = useTerminalStore.getState()
    store.setSymbol('BBCA')
    const panel = listPanels(useTerminalStore.getState().layout)[0]
    useTerminalStore.getState().toggleLock(panel.id)
    useTerminalStore.getState().setSymbol('TLKM')
    const after = listPanels(useTerminalStore.getState().layout).find((row) => row.id === panel.id)
    expect(after?.symbol).toBe('BBCA')
    expect(after?.locked).toBe(true)
    expect(listPanels(useTerminalStore.getState().layout).filter((row) => !row.locked).every((row) => row.symbol === 'TLKM')).toBe(true)
  })
})
