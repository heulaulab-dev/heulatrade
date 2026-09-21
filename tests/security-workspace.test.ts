import { describe, expect, test } from 'vitest'
import { findPanelByType, listPanels, securityWorkspaceLayout, useTerminalStore } from '@/stores/terminal-store'

describe('SECURITY workspace', () => {
  test('new workspaces contain the approved panel order', () => {
    expect(listPanels(securityWorkspaceLayout()).map((panel) => panel.type)).toEqual([
      'CHART', 'SEASONAL', 'QUOTE', 'TAPE', 'BROKER', 'ANALYSIS', 'INSIDER', 'HISTORY', 'FUND',
    ])
  })

  test('symbol changes preserve layout and locked symbols', () => {
    const layout = securityWorkspaceLayout()
    useTerminalStore.setState({ layout, activeSymbol: null, focusedPanel: null, maximizedPanel: null })
    const chart = findPanelByType(layout, 'CHART')!
    useTerminalStore.getState().setSymbol('BBCA')
    useTerminalStore.getState().toggleLock(chart.id)
    const structure = JSON.stringify(useTerminalStore.getState().layout, (key, value) => key === 'symbol' ? undefined : value)
    useTerminalStore.getState().setSymbol('BBRI')
    const after = useTerminalStore.getState().layout
    expect(JSON.stringify(after, (key, value) => key === 'symbol' ? undefined : value)).toBe(structure)
    expect(findPanelByType(after, 'CHART')).toMatchObject({ locked: true, symbol: 'BBCA' })
    expect(findPanelByType(after, 'QUOTE')).toMatchObject({ locked: false, symbol: 'BBRI' })
  })

  test('finds an existing focused-command panel without changing the layout', () => {
    const layout = securityWorkspaceLayout()
    expect(findPanelByType(layout, 'FUND')?.type).toBe('FUND')
    expect(findPanelByType(layout, 'MKTCAP')).toBeNull()
  })

  test('restored customized layouts are not replaced by symbol selection', () => {
    const custom = { kind: 'panel', panel: { id: 'saved-market-cap', type: 'MKTCAP', symbol: null, locked: false, settings: {} } } as const
    useTerminalStore.getState().restore(custom)
    useTerminalStore.getState().setSymbol('BBCA')
    expect(useTerminalStore.getState().layout).toEqual(custom)
  })
})
