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
