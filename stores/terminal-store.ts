'use client'
import { create } from 'zustand'
import { symbolPanels, type PanelType } from '@/lib/commands/registry'
import type { Json } from '@/lib/supabase/database.types'

export type Panel = { id: string; type: PanelType; symbol: string | null; locked: boolean; settings: Record<string, Json | undefined> }
export type LayoutNode = { kind: 'panel'; panel: Panel } | { kind: 'split'; id: string; direction: 'horizontal' | 'vertical'; sizes?: [number, number]; children: [LayoutNode, LayoutNode] }

let sequence = 0
function id() { sequence += 1; return `panel-${Date.now()}-${sequence}` }
const pane = (type: PanelType, symbol: string | null = null): LayoutNode => ({ kind: 'panel', panel: { id: id(), type, symbol, locked: false, settings: {} } })
const defaultPane = (panelId: string, type: PanelType): LayoutNode => ({ kind: 'panel', panel: { id: panelId, type, symbol: null, locked: false, settings: {} } })
const defaultRow = (id: string, left: PanelType, right: PanelType, sizes: [number, number] = [68, 32]): LayoutNode => ({
  kind: 'split', id, direction: 'horizontal', sizes,
  children: [defaultPane(`${id}-left`, left), defaultPane(`${id}-right`, right)],
})

export function securityWorkspaceLayout(): LayoutNode {
  return {
    kind: 'split', id: 'security-root', direction: 'vertical', sizes: [84, 16], children: [
      {
        kind: 'split', id: 'security-upper', direction: 'vertical', sizes: [62, 38], children: [
          { kind: 'split', id: 'security-upper-a', direction: 'vertical', sizes: [68, 32], children: [defaultRow('security-chart', 'CHART', 'SEASONAL'), defaultRow('security-quote', 'QUOTE', 'TAPE', [45, 55])] },
          { kind: 'split', id: 'security-upper-b', direction: 'vertical', sizes: [50, 50], children: [defaultRow('security-broker', 'BROKER', 'ANALYSIS', [55, 45]), defaultRow('security-insider', 'INSIDER', 'HISTORY', [55, 45])] },
        ],
      },
      defaultPane('security-fund', 'FUND'),
    ],
  }
}

const initial = securityWorkspaceLayout()

function mapPanels(node: LayoutNode, fn: (panel: Panel) => Panel): LayoutNode {
  return node.kind === 'panel' ? { kind: 'panel', panel: fn(node.panel) } : { ...node, children: node.children.map((child) => mapPanels(child, fn)) as [LayoutNode, LayoutNode] }
}
function replaceNode(node: LayoutNode, panelId: string, fn: (node: LayoutNode) => LayoutNode): LayoutNode {
  if (node.kind === 'panel') return node.panel.id === panelId ? fn(node) : node
  return { ...node, children: node.children.map((child) => replaceNode(child, panelId, fn)) as [LayoutNode, LayoutNode] }
}
function removeNode(node: LayoutNode, panelId: string): LayoutNode | null {
  if (node.kind === 'panel') return node.panel.id === panelId ? null : node
  const children = node.children.map((child) => removeNode(child, panelId))
  if (!children[0]) return children[1]
  if (!children[1]) return children[0]
  return { ...node, children: children as [LayoutNode, LayoutNode] }
}

interface TerminalState {
  activeSymbol: string | null
  focusedPanel: string | null
  maximizedPanel: string | null
  layout: LayoutNode
  commandError: string | null
  setSymbol: (symbol: string) => void
  setFocused: (id: string) => void
  setCommandError: (message: string | null) => void
  openPanel: (type: PanelType, symbol?: string | null) => void
  replacePanel: (panelId: string, type: PanelType) => void
  splitPanel: (panelId: string, direction: 'horizontal' | 'vertical') => void
  closePanel: (panelId: string) => void
  toggleLock: (panelId: string) => void
  toggleMaximize: (panelId: string) => void
  restore: (layout: LayoutNode) => void
  setSplitSizes: (splitId: string, sizes: [number, number]) => void
}

export const useTerminalStore = create<TerminalState>((set) => ({
  activeSymbol: null, focusedPanel: null, maximizedPanel: null, layout: initial, commandError: null,
  setSymbol: (symbol) => set((state) => ({ activeSymbol: symbol, layout: mapPanels(state.layout, (p) => p.locked || !symbolPanels.has(p.type) ? p : { ...p, symbol }) })),
  setFocused: (focusedPanel) => set({ focusedPanel }),
  setCommandError: (commandError) => set({ commandError }),
  openPanel: (type, symbol) => set((state) => {
    const next = pane(type, symbolPanels.has(type) ? symbol ?? state.activeSymbol : null)
    return { layout: { kind: 'split', id: id(), direction: 'horizontal', children: [state.layout, next] }, focusedPanel: next.kind === 'panel' ? next.panel.id : null }
  }),
  replacePanel: (panelId, type) => set((state) => ({ layout: replaceNode(state.layout, panelId, (node) => node.kind === 'panel' ? { ...node, panel: { ...node.panel, type, settings: {} } } : node) })),
  splitPanel: (panelId, direction) => set((state) => ({ layout: replaceNode(state.layout, panelId, (node) => ({ kind: 'split', id: id(), direction, children: [node, pane(node.kind === 'panel' ? node.panel.type : 'MARKET', state.activeSymbol)] })) })),
  closePanel: (panelId) => set((state) => ({ layout: removeNode(state.layout, panelId) ?? pane('MARKET'), maximizedPanel: state.maximizedPanel === panelId ? null : state.maximizedPanel })),
  toggleLock: (panelId) => set((state) => ({ layout: mapPanels(state.layout, (p) => p.id === panelId ? { ...p, locked: !p.locked, symbol: p.symbol ?? state.activeSymbol } : p) })),
  toggleMaximize: (panelId) => set((state) => ({ maximizedPanel: state.maximizedPanel === panelId ? null : panelId })),
  restore: (layout) => set({ layout, maximizedPanel: null }),
  setSplitSizes: (splitId, sizes) => set((state) => ({ layout: updateSplitSizes(state.layout, splitId, sizes) })),
}))

function updateSplitSizes(node: LayoutNode, splitId: string, sizes: [number, number]): LayoutNode {
  if (node.kind === 'panel') return node
  if (node.id === splitId) {
    if (node.sizes && Math.abs(node.sizes[0] - sizes[0]) < 0.1 && Math.abs(node.sizes[1] - sizes[1]) < 0.1) return node
    return { ...node, sizes }
  }
  const children = node.children.map((child) => updateSplitSizes(child, splitId, sizes)) as [LayoutNode, LayoutNode]
  return children[0] === node.children[0] && children[1] === node.children[1] ? node : { ...node, children }
}

export function findPanel(node: LayoutNode, id: string): Panel | null {
  if (node.kind === 'panel') return node.panel.id === id ? node.panel : null
  return findPanel(node.children[0], id) ?? findPanel(node.children[1], id)
}
export function listPanels(node: LayoutNode): Panel[] {
  return node.kind === 'panel' ? [node.panel] : [...listPanels(node.children[0]), ...listPanels(node.children[1])]
}
export function findPanelByType(node: LayoutNode, type: PanelType): Panel | null {
  return node.kind === 'panel' ? node.panel.type === type ? node.panel : null : findPanelByType(node.children[0], type) ?? findPanelByType(node.children[1], type)
}
