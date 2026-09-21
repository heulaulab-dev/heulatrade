import { z } from 'zod'
import { registry } from '@/lib/commands/registry'

const panelTypes = Object.keys(registry).filter((key) => key !== 'HELP') as [string, ...string[]]
const PanelSchema = z.object({
  id: z.string(), type: z.enum(panelTypes), symbol: z.string().nullable(),
  locked: z.boolean(), settings: z.record(z.unknown()),
})
export const LayoutSchema: z.ZodType<unknown> = z.lazy(() => z.union([
  z.object({ kind: z.literal('panel'), panel: PanelSchema }),
  z.object({ kind: z.literal('split'), id: z.string(), direction: z.enum(['horizontal', 'vertical']), sizes: z.tuple([z.number().min(15).max(85), z.number().min(15).max(85)]).optional(), children: z.tuple([LayoutSchema, LayoutSchema]) }),
]))

export function sameJson(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((value, index) => sameJson(value, b[index]))
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const left = a as Record<string, unknown>
    const right = b as Record<string, unknown>
    const keys = Object.keys(left).filter((key) => left[key] !== undefined)
    return keys.length === Object.keys(right).filter((key) => right[key] !== undefined).length && keys.every((key) => sameJson(left[key], right[key]))
  }
  return false
}
