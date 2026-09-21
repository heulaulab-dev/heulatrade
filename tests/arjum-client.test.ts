import { describe, expect, test, vi } from 'vitest'
import { ArjumClient } from '@/lib/market/arjum/client'
import { historyResponseSchema } from '@/lib/market/arjum/schemas'
import { ArjumError } from '@/lib/market/arjum/errors'

const valid = { stock_code: 'BBCA', frame: 'daily', rows: [] }

describe('ArjumClient', () => {
  test('keeps x-api-key server-side and builds query parameters', async () => {
    const fetcher = vi.fn(async () => Response.json(valid))
    const client = new ArjumClient({ baseUrl: 'https://stock.arjum.com', apiKey: 'rotated-test-key', fetcher })
    await client.get('/api/history/BBCA', historyResponseSchema, { frame: 'daily', limit: 120 })
    expect(fetcher).toHaveBeenCalledWith('https://stock.arjum.com/api/history/BBCA?frame=daily&limit=120', expect.objectContaining({ headers: expect.objectContaining({ 'x-api-key': 'rotated-test-key' }) }))
  })

  test.each([[401, 'PROVIDER_UNAUTHORIZED'], [403, 'PROVIDER_UNAUTHORIZED'], [429, 'RATE_LIMITED'], [500, 'PROVIDER_UNAVAILABLE']] as const)('maps HTTP %s to %s', async (status, code) => {
    const client = new ArjumClient({ baseUrl: 'https://stock.arjum.com', apiKey: 'test', fetcher: async () => new Response('{}', { status }) })
    await expect(client.get('/api/history/BBCA', historyResponseSchema)).rejects.toMatchObject({ code })
  })

  test('classifies valid JSON with schema drift', async () => {
    const client = new ArjumClient({ baseUrl: 'https://stock.arjum.com', apiKey: 'test', fetcher: async () => Response.json({ ...valid, rows: [{ close: 'bad' }] }) })
    await expect(client.get('/api/history/BBCA', historyResponseSchema)).rejects.toEqual(expect.objectContaining<Partial<ArjumError>>({ code: 'MALFORMED_PROVIDER_RESPONSE' }))
  })
})
