import { describe, expect, it } from 'vitest'
import { sameJson } from '@/lib/workspace-schema'

describe('sameJson', () => {
  it('compares stored layouts independently of JSONB object key order', () => {
    const inMemory = { kind: 'panel', panel: { id: 'chart', type: 'CHART', settings: { timeframe: '1D' }, locked: true } }
    const fromDatabase = { panel: { locked: true, settings: { timeframe: '1D' }, type: 'CHART', id: 'chart' }, kind: 'panel' }
    expect(sameJson(inMemory, fromDatabase)).toBe(true)
    expect(sameJson(inMemory, { ...fromDatabase, panel: { ...fromDatabase.panel, locked: false } })).toBe(false)
  })
})
